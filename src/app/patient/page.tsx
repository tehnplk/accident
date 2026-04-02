import { PatientDataGrid, type FilterState, type PatientGridInitialData, type PatientRow } from "@/components/patient-data-grid";
import { dbQuery } from "@/lib/db";

type SearchParamsValue = string | string[] | undefined;

type PatientPageProps = {
  searchParams?: Record<string, SearchParamsValue> | Promise<Record<string, SearchParamsValue>>;
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
          : "visit_date",
    sortDir: pickParam(searchParams.sortDir) === "asc" ? "asc" : "desc",
    page: parsePage(pickParam(searchParams.page), 1),
    pageSize,
  };
}

function buildPatientQuery(filters: FilterState) {
  const whereParts: string[] = [];
  const values: unknown[] = [];

  if (filters.hospital.trim()) {
    values.push(`%${filters.hospital.trim()}%`);
    whereParts.push(`p.hosname ILIKE $${values.length}`);
  }
  if (filters.name.trim()) {
    values.push(`%${filters.name.trim()}%`);
    whereParts.push(`p.patient_name ILIKE $${values.length}`);
  }
  if (filters.hn.trim()) {
    values.push(`%${filters.hn.trim()}%`);
    whereParts.push(`p.hn ILIKE $${values.length}`);
  }
  if (filters.area.trim()) {
    values.push(filters.area.trim());
    whereParts.push(`loc.area = $${values.length}`);
  }
  if (filters.vehicle.trim()) {
    values.push(filters.vehicle.trim());
    whereParts.push(`detail.vehicle = $${values.length}`);
  }
  if (filters.alcohol.trim()) {
    values.push(filters.alcohol.trim());
    whereParts.push(`detail.alcohol = $${values.length}`);
  }
  if (filters.sex) {
    values.push(filters.sex);
    whereParts.push(`p.sex = $${values.length}`);
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
  const pageValues = [...values, filters.pageSize, (filters.page - 1) * filters.pageSize];
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
  `;
  const orderBy =
    filters.sortBy === "visit_date_time"
      ? `p.visit_date ${filters.sortDir.toUpperCase()}, p.visit_time ${filters.sortDir.toUpperCase()}, p.id ${filters.sortDir.toUpperCase()}`
      : filters.sortBy === "age"
        ? `p.age ${filters.sortDir.toUpperCase()} NULLS LAST, p.id ${filters.sortDir.toUpperCase()}`
        : `p.visit_date ${filters.sortDir.toUpperCase()}, p.id ${filters.sortDir.toUpperCase()}`;

  return {
    countQuery: `SELECT count(*)::int AS total ${baseFrom} ${whereClause}`,
    dataQuery: `
      SELECT
        p.id,
        p.hoscode,
        p.hosname,
        p.hn,
        p.cid,
        p.patient_name,
        p.visit_date,
        p.visit_time,
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
        p.pdx,
        p.ext_dx,
        detail.vehicle AS vehicle,
        detail.alcohol AS alcohol,
        loc.area AS area
      ${baseFrom}
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${pageValues.length - 1}
      OFFSET $${pageValues.length}
    `,
    values,
    pageValues,
  };
}

async function loadInitialData(filters: FilterState): Promise<PatientGridInitialData> {
  const { countQuery, dataQuery, values, pageValues } = buildPatientQuery(filters);
  const hospitalQuery = `
    SELECT DISTINCT hosname
    FROM public.patient
    WHERE hosname IS NOT NULL AND hosname <> ''
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
    dbQuery<{ total: number }>(countQuery, values),
    dbQuery<PatientRow>(dataQuery, pageValues),
    dbQuery<{ hosname: string }>(hospitalQuery),
    dbQuery<{ area: string }>(areaQuery),
    dbQuery<{ vehicle: string }>(vehicleQuery),
    dbQuery<{ alcohol: string }>(alcoholQuery),
  ]);

  return {
    rows: rowsResult.rows,
    total: countResult.rows[0]?.total ?? 0,
    filters,
    hospitalOptions: hospitalResult.rows.map((row) => row.hosname),
    areaOptions: areaResult.rows.map((row) => row.area),
    vehicleOptions: vehicleResult.rows.map((row) => row.vehicle),
    alcoholOptions: alcoholResult.rows.map((row) => row.alcohol),
  };
}

export default async function PatientPage(props: PatientPageProps) {
  const resolvedSearchParams = await Promise.resolve(props.searchParams ?? {});
  const initialFilters = parseInitialFilters(resolvedSearchParams);
  const initialData = await loadInitialData(initialFilters);

  return <PatientDataGrid initialData={initialData} />;
}
