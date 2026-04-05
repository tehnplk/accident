import {
  PatientDataGrid,
  type FilterState,
  type HospitalOption,
  type PatientGridInitialData,
  type PatientRow,
} from "@/components/patient-data-grid";
import { dbQuery } from "@/lib/db";
import {
  createPatientApiToken,
  getPatientAesSecret,
  patientDecryptedColumnSql,
} from "@/lib/patient-security";
import { normalizeShiftName } from "@/lib/shift";
import { auth } from "@/authConfig";
import { logActivity, parseProfileFromSession, sessionHasExportAccess } from "@/lib/activity-log";

type SearchParamsValue = string | string[] | undefined;

type PatientPageProps = {
  searchParams?: Promise<Record<string, SearchParamsValue>>;
};

const PAGE_SIZES = new Set([20, 50, 100]);

function pickParam(value: SearchParamsValue) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parsePage(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseInitialFilters(searchParams: Record<string, SearchParamsValue>): FilterState {
  const pageSizeRaw = parsePage(pickParam(searchParams.pageSize ?? ""), 20);
  const pageSize = PAGE_SIZES.has(pageSizeRaw) ? pageSizeRaw : 20;

  return {
    hospital: pickParam(searchParams.hospital),
    name: pickParam(searchParams.name),
    hn: pickParam(searchParams.hn),
    area: pickParam(searchParams.area),
    vehicle: pickParam(searchParams.vehicle),
    alcohol: pickParam(searchParams.alcohol),
    sex: pickParam(searchParams.sex),
    sortBy:
      pickParam(searchParams.sortBy) === "visit_date_time"
        ? "visit_date_time"
        : pickParam(searchParams.sortBy) === "age"
          ? "age"
          : pickParam(searchParams.sortBy) === "created_at"
            ? "created_at"
          : "visit_date_time",
    sortDir: pickParam(searchParams.sortDir) === "asc" ? "asc" : "desc",
    page: parsePage(pickParam(searchParams.page), 1),
    pageSize,
  };
}

function buildPatientQuery(filters: FilterState) {
  const aesSecret = getPatientAesSecret();
  const filterValues: unknown[] = [];
  const whereParts: string[] = [];
  const hospitalParam = filters.hospital.trim() ? `%${filters.hospital.trim()}%` : null;
  const nameParam = filters.name.trim() ? `%${filters.name.trim()}%` : null;
  const hnParam = filters.hn.trim() ? `%${filters.hn.trim()}%` : null;
  const areaParam = filters.area.trim() || null;
  const vehicleParam = filters.vehicle.trim() || null;
  const alcoholParam = filters.alcohol.trim() || null;
  const sexParam = filters.sex || null;

  if (hospitalParam) filterValues.push(hospitalParam);
  if (nameParam) filterValues.push(nameParam);
  if (hnParam) filterValues.push(hnParam);
  if (areaParam) filterValues.push(areaParam);
  if (vehicleParam) filterValues.push(vehicleParam);
  if (alcoholParam) filterValues.push(alcoholParam);
  if (sexParam) filterValues.push(sexParam);

  const dataSecretParamIndex = filterValues.length + 1;
  const decryptedPatientNameSql = patientDecryptedColumnSql("patient_name", dataSecretParamIndex);
  const decryptedHnSql = patientDecryptedColumnSql("hn", dataSecretParamIndex);
  const decryptedCidSql = patientDecryptedColumnSql("cid", dataSecretParamIndex);
  let paramIndex = 0;

  if (hospitalParam) {
    paramIndex += 1;
    whereParts.push(`p.hosname ILIKE $${paramIndex}`);
  }
  if (nameParam) {
    paramIndex += 1;
    whereParts.push(`${decryptedPatientNameSql} ILIKE $${paramIndex}`);
  }
  if (hnParam) {
    paramIndex += 1;
    whereParts.push(`${decryptedHnSql} ILIKE $${paramIndex}`);
  }
  if (areaParam) {
    paramIndex += 1;
    whereParts.push(`loc.area = $${paramIndex}`);
  }
  if (vehicleParam) {
    paramIndex += 1;
    whereParts.push(`detail.vehicle = $${paramIndex}`);
  }
  if (alcoholParam) {
    paramIndex += 1;
    whereParts.push(`detail.alcohol = $${paramIndex}`);
  }
  if (sexParam) {
    paramIndex += 1;
    whereParts.push(`p.sex = $${paramIndex}`);
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
  const countValues = nameParam || hnParam ? [...filterValues, aesSecret] : filterValues;
  const pageValues = [...filterValues, aesSecret, filters.pageSize, (filters.page - 1) * filters.pageSize];
  const baseFrom = `
      FROM public.patient p
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(NULLIF(pd.acd_vihicle_addon, ''), av.name) AS vehicle,
          COALESCE(NULLIF(pd.acd_alcohol_addon, ''), aa.name) AS alcohol
        FROM public.patient_detail pd
        LEFT JOIN public.acd_vihicle av ON av.code = pd.acd_vihicle
        LEFT JOIN public.acd_alcohol aa ON aa.code = pd.acd_alcohol
        WHERE pd.patient_id = p.id
        LIMIT 1
      ) detail ON TRUE
      LEFT JOIN LATERAL (
        SELECT d.name_in_thai AS area
        FROM public.patient_acd_location l
        LEFT JOIN public.districts d ON d.code::text = l.amp_code
        WHERE l.patient_id = p.id
        ORDER BY l.id DESC
        LIMIT 1
      ) loc ON TRUE
      LEFT JOIN LATERAL (
        SELECT tt.time_name AS shift_name
        FROM public.timetable tt
        WHERE (
          (tt.time_begin <= tt.time_end AND p.visit_time BETWEEN tt.time_begin AND tt.time_end)
          OR (tt.time_begin > tt.time_end AND (p.visit_time >= tt.time_begin OR p.visit_time <= tt.time_end))
        )
        ORDER BY tt.id ASC
        LIMIT 1
      ) shift ON TRUE
  `;
  const orderBy =
    filters.sortBy === "visit_date_time"
      ? `p.visit_date ${filters.sortDir.toUpperCase()}, p.visit_time ${filters.sortDir.toUpperCase()}, p.id ${filters.sortDir.toUpperCase()}`
      : filters.sortBy === "age"
        ? `p.age ${filters.sortDir.toUpperCase()} NULLS LAST, p.id ${filters.sortDir.toUpperCase()}`
        : filters.sortBy === "created_at"
          ? `p.created_at ${filters.sortDir.toUpperCase()} NULLS LAST, p.id ${filters.sortDir.toUpperCase()}`
        : `p.visit_date ${filters.sortDir.toUpperCase()}, p.id ${filters.sortDir.toUpperCase()}`;

  return {
    countQuery: `SELECT count(*)::int AS total ${baseFrom} ${whereClause}`,
    dataQuery: `
      SELECT
        p.id,
        p.hoscode,
        p.hosname,
        ${decryptedHnSql} AS hn,
        ${decryptedCidSql} AS cid,
        ${decryptedPatientNameSql} AS patient_name,
        to_char(p.visit_date, 'YYYY-MM-DD') AS visit_date,
        to_char(p.visit_time, 'HH24:MI:SS') AS visit_time,
        p.sex,
        p.age,
        p.house_no,
        p.moo,
        p.road,
        p.tumbon,
        p.amphoe,
        p.changwat,
        p.cc,
        p.status,
        p.triage,
        p.source,
        p.pdx,
        p.ext_dx,
        detail.vehicle AS vehicle,
        detail.alcohol AS alcohol,
        shift.shift_name AS shift_name,
        loc.area AS area,
        to_char(p.created_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS') AS created_at,
        to_char(p.updated_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS') AS updated_at
      ${baseFrom}
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${pageValues.length - 1}
      OFFSET $${pageValues.length}
    `,
    countValues,
    pageValues,
  };
}

async function loadInitialData(filters: FilterState): Promise<PatientGridInitialData> {
  const { countQuery, dataQuery, countValues, pageValues } = buildPatientQuery(filters);
  const hospitalQuery = `
    SELECT DISTINCT hoscode, hosname
    FROM public.hos
    WHERE hosname IS NOT NULL AND hosname <> ''
      AND hoscode IS NOT NULL AND hoscode <> ''
    ORDER BY hosname ASC
  `;
  const areaQuery = `
    SELECT DISTINCT area
    FROM (
      SELECT d.name_in_thai AS area
      FROM public.patient_acd_location l
      JOIN public.districts d ON d.code::text = l.amp_code
      WHERE d.name_in_thai IS NOT NULL AND d.name_in_thai <> ''
    ) x
    ORDER BY area ASC
  `;
  const vehicleQuery = `
    SELECT DISTINCT vehicle
    FROM (
      SELECT COALESCE(NULLIF(pd.acd_vihicle_addon, ''), av.name) AS vehicle
      FROM public.patient_detail pd
      LEFT JOIN public.acd_vihicle av ON av.code = pd.acd_vihicle
      WHERE COALESCE(NULLIF(pd.acd_vihicle_addon, ''), av.name) IS NOT NULL
        AND COALESCE(NULLIF(pd.acd_vihicle_addon, ''), av.name) <> ''
    ) x
    ORDER BY vehicle ASC
  `;
  const alcoholQuery = `
    SELECT aa.name AS alcohol
    FROM public.acd_alcohol aa
    WHERE aa.name IS NOT NULL AND aa.name <> ''
    ORDER BY aa.code ASC, aa.name ASC
  `;
  const [countResult, rowsResult, hospitalResult, areaResult, vehicleResult, alcoholResult] = await Promise.all([
    dbQuery<{ total: number }>(countQuery, countValues),
    dbQuery<PatientRow>(dataQuery, pageValues),
    dbQuery<HospitalOption>(hospitalQuery),
    dbQuery<{ area: string }>(areaQuery),
    dbQuery<{ vehicle: string }>(vehicleQuery),
    dbQuery<{ alcohol: string }>(alcoholQuery),
  ]);

  const rows = rowsResult.rows.map((row) => ({
    ...row,
    shift_name: normalizeShiftName(row.visit_time, row.shift_name),
  }));
  const uniqueHospitalNames = Array.from(
    new Set(hospitalResult.rows.map((row) => row.hosname).filter((value): value is string => Boolean(value))),
  );

  return {
    rows,
    total: countResult.rows[0]?.total ?? 0,
    filters,
    authToken: createPatientApiToken(),
    canExportXlsx: false,
    hospitalOptions: uniqueHospitalNames,
    hospitalChoices: hospitalResult.rows,
    areaOptions: areaResult.rows.map((row) => row.area),
    vehicleOptions: vehicleResult.rows.map((row) => row.vehicle),
    alcoholOptions: alcoholResult.rows.map((row) => row.alcohol),
  };
}

export default async function PatientPage(props: PatientPageProps) {
  const resolvedSearchParams = await Promise.resolve(props.searchParams ?? {});
  const initialFilters = parseInitialFilters(resolvedSearchParams);

  const session = await auth();
  const profile = parseProfileFromSession(session);
  const canExportXlsx = sessionHasExportAccess(profile);
  if (profile) {
    const fullName =
      [profile.title_th, profile.firstname_th, profile.lastname_th].filter(Boolean).join("") ||
      profile.name_th ||
      null;

    let department: string | null = null;
    const orgRaw = profile.organization;
    if (Array.isArray(orgRaw) && orgRaw.length > 0) {
      department = orgRaw
        .map((item: unknown) => {
          const pos = typeof item === "string" ? JSON.parse(item) : item;
          return pos?.hname_th ?? null;
        })
        .filter(Boolean)
        .join(" | ") || null;
    } else if (typeof orgRaw === "string") {
      department = orgRaw;
    }

    await logActivity({
      providerId: profile.provider_id ?? profile.account_id ?? "unknown",
      fullName: fullName || null,
      department,
      route: "/patient",
    });
  }

  const initialData = await loadInitialData(initialFilters);
  initialData.canExportXlsx = canExportXlsx;

  return <PatientDataGrid initialData={initialData} />;
}
