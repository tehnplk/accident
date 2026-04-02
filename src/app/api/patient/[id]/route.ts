import { NextRequest, NextResponse } from "next/server";
import { dbQuery, dbTransaction } from "@/lib/db";
import {
  getPatientAesSecret,
  patientApiAuthorized,
  patientDecryptedColumnSql,
  patientEncryptedValueSql,
} from "@/lib/patient-security";

type UpdateBody = {
  hoscode?: string;
  hosname?: string;
  hn?: string;
  cid?: string;
  patient_name?: string;
  sex?: string;
  visit_date?: string;
  visit_time?: string;
  age?: number | string | null;
  changwat?: string;
  amphoe?: string;
  tumbon?: string;
  moo?: string;
  road?: string;
  cc?: string;
  triage?: string;
  status?: string;
};

const ALLOWED_FIELDS: Array<keyof UpdateBody> = [
  "hoscode",
  "hosname",
  "hn",
  "cid",
  "patient_name",
  "sex",
  "visit_date",
  "visit_time",
  "age",
  "changwat",
  "amphoe",
  "tumbon",
  "moo",
  "road",
  "cc",
  "triage",
  "status",
];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!patientApiAuthorized(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const rowId = Number.parseInt(id, 10);

    if (!Number.isFinite(rowId) || rowId <= 0) {
      return NextResponse.json({ message: "Invalid patient id" }, { status: 400 });
    }

    const body = (await request.json()) as UpdateBody;
    const aesSecret = getPatientAesSecret();
    const updates: string[] = [];
    const values: unknown[] = [aesSecret];

    for (const field of ALLOWED_FIELDS) {
      const raw = body[field];
      if (typeof raw === "string") {
        values.push(raw.trim());
        if (field === "hn" || field === "cid" || field === "patient_name") {
          updates.push(`${field} = ${patientEncryptedValueSql(values.length, 1)}`);
        } else {
          updates.push(`${field} = $${values.length}`);
        }
      } else if (field === "age" && (typeof raw === "number" || raw === null)) {
        values.push(raw);
        updates.push(`${field} = $${values.length}`);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: "No update fields provided" }, { status: 400 });
    }

    values.push(rowId);
    const sql = `
      WITH updated AS (
        UPDATE public.patient
        SET ${updates.join(", ")}
        WHERE id = $${values.length}
        RETURNING
          id,
          hoscode,
          hosname,
          hn,
          cid,
          patient_name,
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
          pdx,
          ext_dx
      )
      SELECT
        id,
        hoscode,
        hosname,
        ${patientDecryptedColumnSql("hn", 1, "updated")} AS hn,
        ${patientDecryptedColumnSql("cid", 1, "updated")} AS cid,
        ${patientDecryptedColumnSql("patient_name", 1, "updated")} AS patient_name,
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
        pdx,
        ext_dx
      FROM updated
    `;

    const result = await dbQuery(sql, values);
    if (result.rowCount === 0) {
      return NextResponse.json({ message: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json({ row: result.rows[0] });
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
        message: "Failed to update patient",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!patientApiAuthorized(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const rowId = Number.parseInt(id, 10);

    if (!Number.isFinite(rowId) || rowId <= 0) {
      return NextResponse.json({ message: "Invalid patient id" }, { status: 400 });
    }

    const deleted = await dbTransaction(async (client) => {
      await client.query("DELETE FROM public.patient_detail WHERE patient_id = $1", [rowId]);
      await client.query("DELETE FROM public.patient_acd_location WHERE patient_id = $1", [rowId]);
      const result = await client.query(
        `DELETE FROM public.patient
         WHERE id = $1
         RETURNING id`,
        [rowId],
      );
      return result.rows[0] ?? null;
    });

    if (!deleted) {
      return NextResponse.json({ message: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to delete patient",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
