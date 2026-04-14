import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import {
  getPatientAesSecret,
  patientApiAuthorized,
  patientDecryptedColumnSql,
} from "@/lib/patient-security";

type RejectPatientBody = {
  patient_id?: unknown;
  is_rejected?: unknown;
  rejected_note?: unknown;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDiagnosisValue<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return (trimmed || null) as T | null;
  }
  return String(value) as T;
}

export async function PATCH(request: NextRequest) {
  try {
    if (!patientApiAuthorized(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as RejectPatientBody;
    const patientId = Number.parseInt(String(body.patient_id ?? ""), 10);
    const isRejected = body.is_rejected;
    const rejectedNote = normalizeText(body.rejected_note);

    if (!Number.isFinite(patientId) || patientId <= 0) {
      return NextResponse.json({ message: "patient_id is required" }, { status: 400 });
    }

    if (typeof isRejected !== "boolean") {
      return NextResponse.json({ message: "is_rejected must be boolean" }, { status: 400 });
    }

    if (isRejected && !rejectedNote) {
      return NextResponse.json({ message: "rejected_note is required" }, { status: 400 });
    }

    const aesSecret = getPatientAesSecret();
    const sql = `
      WITH updated AS (
        UPDATE public.patient
        SET
          is_rejected = $2,
          rejected_note = $3
        WHERE id = $1
        RETURNING
          id,
          hoscode,
          hosname,
          hn,
          cid,
          patient_name,
          vn,
          to_char(visit_date, 'YYYY-MM-DD') AS visit_date,
          to_char(visit_time, 'HH24:MI:SS') AS visit_time,
          sex,
          age,
          source,
          house_no,
          moo,
          road,
          tumbon,
          amphoe,
          changwat,
          cc,
          status,
          triage,
          is_rejected,
          rejected_note,
          pdx,
          ext_dx,
          dx_list,
          alcohol
      )
      SELECT
        id,
        hoscode,
        hosname,
        ${patientDecryptedColumnSql("hn", 4, "updated")} AS hn,
        ${patientDecryptedColumnSql("cid", 4, "updated")} AS cid,
        ${patientDecryptedColumnSql("patient_name", 4, "updated")} AS patient_name,
        vn,
        visit_date,
        visit_time,
        sex,
        age,
        source,
        house_no,
        moo,
        road,
        tumbon,
        amphoe,
        changwat,
        cc,
        status,
        triage,
        is_rejected,
        rejected_note,
        pdx,
        ext_dx,
        dx_list,
        alcohol
      FROM updated
    `;

    const result = await dbQuery(sql, [patientId, isRejected, rejectedNote || null, aesSecret]);
    if (result.rowCount === 0) {
      return NextResponse.json({ message: "Patient not found" }, { status: 404 });
    }

    const row = result.rows[0]
      ? {
          ...result.rows[0],
          pdx: parseDiagnosisValue(result.rows[0].pdx),
          ext_dx: parseDiagnosisValue(result.rows[0].ext_dx),
          dx_list: parseDiagnosisValue(result.rows[0].dx_list),
        }
      : null;

    return NextResponse.json({ row });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to reject patient",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
