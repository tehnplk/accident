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
const MIN_PATIENT_VISIT_DATE = "2026-04-10";

type CreatePatientBody = {
  hoscode?: string;
  hosname?: string;
  hn?: string;
  cid?: string;
  patient_name?: string;
  vn?: string;
  visit_date?: string;
  visit_time?: string;
  sex?: string;
  age?: number | string | null;
  house_no?: string;
  moo?: string;
  road?: string;
  tumbon?: string;
  amphoe?: string;
  changwat?: string;
  triage?: string;
  status?: string;
  cc?: string;
  pdx?: unknown;
  ext_dx?: unknown;
  dx_list?: unknown;
  alcohol?: number | string | null;
  source?: string;
};

function parsePage(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function serializeDiagnosisValue(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function parseDiagnosisValue<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return (trimmed || null) as T | null;
  }
  return String(value) as T;
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
    const visitDate = params.get("visit_date")?.trim() ?? "";
    const alcohol = params.get("alcohol")?.trim() ?? "";
    const sex = params.get("sex")?.trim() ?? "";
    const isRejected = params.get("is_rejected") === "true";
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
    const hospitalParam = hospital || null;
    const nameParam = name ? `%${name}%` : null;
    const hnParam = hn ? `%${hn}%` : null;
    const areaParam = area || null;
    const visitDateParam = visitDate || null;
    const alcoholParam = alcohol || null;
    const sexParam = sex || null;

    if (hospitalParam) filterValues.push(hospitalParam);
    if (nameParam) filterValues.push(nameParam);
    if (hnParam) filterValues.push(hnParam);
    if (areaParam) filterValues.push(areaParam);
    if (visitDateParam) filterValues.push(visitDateParam);
    if (alcoholParam) filterValues.push(alcoholParam);
    if (sexParam) filterValues.push(sexParam);
    whereParts.push(isRejected ? "p.is_rejected = true" : "COALESCE(p.is_rejected, false) = false");

    const dataSecretParamIndex = filterValues.length + 1;
    const decryptedPatientNameSql = patientDecryptedColumnSql("patient_name", dataSecretParamIndex);
    const decryptedHnSql = patientDecryptedColumnSql("hn", dataSecretParamIndex);
    const decryptedCidSql = patientDecryptedColumnSql("cid", dataSecretParamIndex);
    let paramIndex = 0;

    if (hospitalParam) {
      paramIndex += 1;
      whereParts.push(`p.hoscode = $${paramIndex}`);
    }
    if (nameParam) {
      paramIndex += 1;
      whereParts.push(`(${decryptedPatientNameSql} ILIKE $${paramIndex} OR p.id::text ILIKE $${paramIndex})`);
    }
    if (hnParam) {
      paramIndex += 1;
      whereParts.push(`${decryptedHnSql} ILIKE $${paramIndex}`);
    }
    if (areaParam) {
      paramIndex += 1;
      whereParts.push(`loc.area = $${paramIndex}`);
    }
    if (visitDateParam) {
      paramIndex += 1;
      whereParts.push(`p.visit_date = $${paramIndex}::date`);
    }
    if (alcoholParam) {
      paramIndex += 1;
      whereParts.push(`p.alcohol = $${paramIndex}::smallint`);
    }
    if (sexParam) {
      paramIndex += 1;
      whereParts.push(`p.sex = $${paramIndex}`);
    }
    whereParts.push(`p.visit_date >= DATE '${MIN_PATIENT_VISIT_DATE}'`);

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
    const baseFrom = `
      FROM public.patient p
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(NULLIF(pd.acd_vihicle_addon, ''), av.name) AS vehicle
        FROM public.patient_detail pd
        LEFT JOIN public.acd_vihicle av ON av.code = pd.acd_vihicle
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
      LEFT JOIN LATERAL (
        SELECT true AS has_expect_not_accident
        FROM public.patient_expect_not_accident pena
        WHERE pena.patient_id = p.id
        LIMIT 1
      ) expect_not_accident ON TRUE
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
        p.is_rejected,
        p.pdx,
        p.ext_dx,
        p.dx_list,
        p.alcohol,
        detail.vehicle AS vehicle,
        shift.shift_name AS shift_name,
        loc.area AS area,
        COALESCE(expect_not_accident.has_expect_not_accident, false) AS has_expect_not_accident,
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
      pdx: parseDiagnosisValue(row.pdx),
      ext_dx: parseDiagnosisValue(row.ext_dx),
      dx_list: parseDiagnosisValue(row.dx_list),
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

    const body = (await request.json()) as CreatePatientBody & {
      is_rejected?: unknown;
      rejected_note?: unknown;
    };
    console.log(`[${new Date().toISOString()}] [POST /api/patient] payload:`, body);

    const hoscode = normalizeText(body.hoscode) || null;
    const hosname = normalizeText(body.hosname) || null;
    const hn = normalizeText(body.hn) || null;
    const cid = normalizeText(body.cid);
    const patientName = normalizeText(body.patient_name);
    const vn = normalizeText(body.vn) || null;
    const visitDate = normalizeText(body.visit_date) || null;
    const visitTime = normalizeText(body.visit_time) || null;
    const sex = normalizeText(body.sex) || null;
    const houseNo = normalizeText(body.house_no) || null;
    const moo = normalizeText(body.moo) || null;
    const road = normalizeText(body.road) || null;
    const tumbon = normalizeText(body.tumbon) || null;
    const amphoe = normalizeText(body.amphoe) || null;
    const changwat = normalizeText(body.changwat) || null;
    const triage = normalizeText(body.triage) || null;
    const status = normalizeText(body.status) || null;
    const cc = normalizeText(body.cc) || null;
    const source = normalizeText(body.source) || "man";
    const pdxValue = serializeDiagnosisValue(body.pdx);
    const extDxValue = serializeDiagnosisValue(body.ext_dx);
    const dxListValue = serializeDiagnosisValue(body.dx_list);
    const alcoholValue =
      body.alcohol === null || body.alcohol === undefined || body.alcohol === ""
        ? 0
        : Number.parseInt(String(body.alcohol), 10) === 1
          ? 1
          : 0;

    if (!hoscode) {
      return NextResponse.json({ message: "Hospital code (hoscode) is required" }, { status: 400 });
    }

    if (!cid) {
      return NextResponse.json({ message: "CID / Passport is required" }, { status: 400 });
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

    // POST /api/patient must never create or overwrite rejection state.
    // patient.is_rejected and patient.rejected_note are controlled only by PATCH /api/patient/[id].

    // Always upsert by (hoscode, cid_hash, visit_date) so duplicate pushes
    // update the existing visit regardless of source.
    const upsertClause = `ON CONFLICT (hoscode, cid_hash, visit_date)
       WHERE hoscode IS NOT NULL AND cid_hash IS NOT NULL AND visit_date IS NOT NULL
       DO UPDATE SET
        hosname          = EXCLUDED.hosname,
        hn               = EXCLUDED.hn,
        cid              = EXCLUDED.cid,
        cid_hash         = EXCLUDED.cid_hash,
        patient_name     = EXCLUDED.patient_name,
        vn               = COALESCE(EXCLUDED.vn, public.patient.vn),
        visit_date       = EXCLUDED.visit_date,
        visit_time       = EXCLUDED.visit_time,
        sex              = EXCLUDED.sex,
        age              = EXCLUDED.age,
        house_no         = EXCLUDED.house_no,
        moo              = EXCLUDED.moo,
        road             = EXCLUDED.road,
        tumbon           = EXCLUDED.tumbon,
        amphoe           = EXCLUDED.amphoe,
        changwat         = EXCLUDED.changwat,
        triage           = EXCLUDED.triage,
        status           = EXCLUDED.status,
        cc               = EXCLUDED.cc,
        source           = EXCLUDED.source,
        alcohol          = EXCLUDED.alcohol,
        pdx              = EXCLUDED.pdx,
        ext_dx           = EXCLUDED.ext_dx,
        dx_list          = EXCLUDED.dx_list,
        updated_at       = now()`;

    const sql = `
      WITH inserted AS (
        INSERT INTO public.patient (
          hoscode,
          hosname,
          hn,
          cid,
          cid_hash,
          patient_name,
          vn,
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
          triage,
          status,
          cc,
          source,
          alcohol,
          pdx,
          ext_dx,
          dx_list
        )
        VALUES (
          $1,
          $2,
          ${patientEncryptedValueSql(3, 20)},
          ${patientEncryptedValueSql(4, 20)},
          encode(digest($4::bytea, 'sha256'), 'hex'),
          ${patientEncryptedValueSql(5, 20)},
          $22,
          COALESCE($6::date, CURRENT_DATE),
          COALESCE($7::time, LOCALTIME(0)),
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          $19,
          $21,
          $23,
          $24,
          $25
        )
        ${upsertClause}
        RETURNING
          id,
          hoscode,
          hosname,
          hn,
          cid,
          patient_name,
          vn,
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
          is_rejected,
          pdx,
          ext_dx,
          dx_list,
          alcohol
      )
      SELECT
        id,
        hoscode,
        hosname,
        ${patientDecryptedColumnSql("hn", 20, "inserted")} AS hn,
        ${patientDecryptedColumnSql("cid", 20, "inserted")} AS cid,
        ${patientDecryptedColumnSql("patient_name", 20, "inserted")} AS patient_name,
        vn,
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
        is_rejected,
        pdx,
        ext_dx,
        dx_list,
        alcohol
      FROM inserted
    `;

    const result = await dbQuery(sql, [
      hoscode,       // $1
      hosname,       // $2
      hn,            // $3 (encrypted)
      cid,           // $4 (encrypted)
      patientName,   // $5 (encrypted)
      visitDate,     // $6
      visitTime,     // $7
      sex,           // $8
      ageValue,      // $9
      houseNo,       // $10
      moo,           // $11
      road,          // $12
      tumbon,        // $13
      amphoe,        // $14
      changwat,      // $15
      triage,        // $16
      status,        // $17
      cc,            // $18
      source,        // $19
      aesSecret,     // $20
      alcoholValue,  // $21
      vn,            // $22
      pdxValue,      // $23
      extDxValue,    // $24
      dxListValue,   // $25
    ]);

    const row = result.rows[0]
      ? {
          ...result.rows[0],
          pdx: parseDiagnosisValue(result.rows[0].pdx),
          ext_dx: parseDiagnosisValue(result.rows[0].ext_dx),
          dx_list: parseDiagnosisValue(result.rows[0].dx_list),
        }
      : null;

    return NextResponse.json({ row }, { status: 201 });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "23505") {
      return NextResponse.json(
        { message: "ข้อมูลซ้ำ: hoscode + CID / Passport + visit_date นี้มีอยู่แล้วในระบบ" },
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
