import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import {
  getPatientAesSecret,
  patientApiAuthorized,
  patientDecryptedColumnSql,
  patientEncryptedValueSql,
} from "@/lib/patient-security";
import { normalizeShiftName } from "@/lib/shift";

const PAGE_SIZES = new Set([20, 50, 100]);

type CreatePatientBody = {
  hoscode?: string;
  hosname?: string;
  hn?: string;
  cid?: string;
  patient_name?: string;
  visit_date?: string;
  visit_time?: string;
  sex?: string;
  age?: number | string | null;
  triage?: string;
  status?: string;
  cc?: string;
};

function parsePage(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  try {
    if (!patientApiAuthorized(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const hospital = params.get("hospital")?.trim() ?? "";
    const name = params.get("name")?.trim() ?? "";
    const hn = params.get("hn")?.trim() ?? "";
    const area = params.get("area")?.trim() ?? "";
    const vehicle = params.get("vehicle")?.trim() ?? "";
    const alcohol = params.get("alcohol")?.trim() ?? "";
    const sex = params.get("sex")?.trim() ?? "";
    const sortBy =
      params.get("sortBy") === "visit_date_time"
        ? "visit_date_time"
        : params.get("sortBy") === "age"
          ? "age"
          : params.get("sortBy") === "created_at"
            ? "created_at"
          : "visit_date_time";
    const sortDir = params.get("sortDir") === "asc" ? "asc" : "desc";

    const page = parsePage(params.get("page"), 1);
    const pageSizeRaw = parsePage(params.get("pageSize"), 20);
    const pageSize = PAGE_SIZES.has(pageSizeRaw) ? pageSizeRaw : 20;
    const offset = (page - 1) * pageSize;

    const aesSecret = getPatientAesSecret();
    const filterValues: unknown[] = [];
    const whereParts: string[] = [];
    const hospitalParam = hospital ? `%${hospital}%` : null;
    const nameParam = name ? `%${name}%` : null;
    const hnParam = hn ? `%${hn}%` : null;
    const areaParam = area || null;
    const vehicleParam = vehicle || null;
    const alcoholParam = alcohol || null;
    const sexParam = sex || null;

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
      sortBy === "visit_date_time"
        ? `p.visit_date ${sortDir.toUpperCase()}, p.visit_time ${sortDir.toUpperCase()}, p.id ${sortDir.toUpperCase()}`
        : sortBy === "age"
          ? `p.age ${sortDir.toUpperCase()} NULLS LAST, p.id ${sortDir.toUpperCase()}`
          : sortBy === "created_at"
            ? `p.created_at ${sortDir.toUpperCase()} NULLS LAST, p.id ${sortDir.toUpperCase()}`
          : `p.visit_date ${sortDir.toUpperCase()}, p.id ${sortDir.toUpperCase()}`;

    const countQuery = `SELECT count(*)::int AS total ${baseFrom} ${whereClause}`;
    const countValues = nameParam || hnParam ? [...filterValues, aesSecret] : filterValues;
    const countResult = await dbQuery<{ total: number }>(countQuery, countValues);
    const total = countResult.rows[0]?.total ?? 0;

    const pageValues = [...filterValues, aesSecret, pageSize, offset];
    const dataQuery = `
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
    `;

    const rowsResult = await dbQuery(dataQuery, pageValues);
    const rows = rowsResult.rows.map((row) => ({
      ...row,
      shift_name: normalizeShiftName(row.visit_time, row.shift_name),
    }));

    return NextResponse.json({
      page,
      pageSize,
      total,
      rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to load patient list",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!patientApiAuthorized(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CreatePatientBody;
    const hoscode = normalizeText(body.hoscode) || null;
    const hosname = normalizeText(body.hosname) || null;
    const hn = normalizeText(body.hn) || null;
    const cid = normalizeText(body.cid);
    const patientName = normalizeText(body.patient_name);
    const visitDate = normalizeText(body.visit_date) || null;
    const visitTime = normalizeText(body.visit_time) || null;
    const sex = normalizeText(body.sex) || null;
    const triage = normalizeText(body.triage) || null;
    const status = normalizeText(body.status) || null;
    const cc = normalizeText(body.cc) || null;

    if (!cid) {
      return NextResponse.json({ message: "CID is required" }, { status: 400 });
    }

    if (!patientName) {
      return NextResponse.json({ message: "Patient name is required" }, { status: 400 });
    }

    const ageValue =
      body.age === null || body.age === undefined || body.age === ""
        ? null
        : Number.parseInt(String(body.age), 10);

    if (ageValue !== null && (!Number.isFinite(ageValue) || ageValue < 0 || ageValue > 150)) {
      return NextResponse.json({ message: "Age must be between 0 and 150" }, { status: 400 });
    }

    const aesSecret = getPatientAesSecret();
    const sql = `
      WITH inserted AS (
        INSERT INTO public.patient (
          hoscode,
          hosname,
          hn,
          cid,
          patient_name,
          visit_date,
          visit_time,
          sex,
          age,
          triage,
          status,
          cc,
          source
        )
        VALUES (
          $1,
          $2,
          ${patientEncryptedValueSql(3, 14)},
          ${patientEncryptedValueSql(4, 14)},
          ${patientEncryptedValueSql(5, 14)},
          COALESCE($6::date, CURRENT_DATE),
          COALESCE($7::time, LOCALTIME(0)),
          $8,
          $9,
          $10,
          $11,
          $12,
          $13
        )
        RETURNING
          id,
          hoscode,
          hosname,
          hn,
          cid,
          patient_name,
          visit_date,
          visit_time,
          sex,
          age,
          house_no,
          moo,
          road,
          tumbon,
          amphoe,
          changwat,
          cc,
          status,
          triage,
          source,
          pdx,
          ext_dx
      )
      SELECT
        id,
        hoscode,
        hosname,
        ${patientDecryptedColumnSql("hn", 14, "inserted")} AS hn,
        ${patientDecryptedColumnSql("cid", 14, "inserted")} AS cid,
        ${patientDecryptedColumnSql("patient_name", 14, "inserted")} AS patient_name,
        to_char(visit_date, 'YYYY-MM-DD') AS visit_date,
        to_char(visit_time, 'HH24:MI:SS') AS visit_time,
        sex,
        age,
        house_no,
        moo,
        road,
        tumbon,
        amphoe,
        changwat,
        cc,
        status,
        triage,
        source,
        pdx,
        ext_dx
      FROM inserted
    `;

    const result = await dbQuery(sql, [
      hoscode,
      hosname,
      hn,
      cid,
      patientName,
      visitDate,
      visitTime,
      sex,
      ageValue,
      triage,
      status,
      cc,
      "man",
      aesSecret,
    ]);

    return NextResponse.json({ row: result.rows[0] }, { status: 201 });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "23505") {
      return NextResponse.json(
        { message: "Duplicate hoscode + hn + visit_date is not allowed" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        message: "Failed to create patient",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
