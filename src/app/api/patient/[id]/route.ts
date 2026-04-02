import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

type UpdateBody = {
  hosname?: string;
  hn?: string;
  patient_name?: string;
  sex?: string;
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
  "hosname",
  "hn",
  "patient_name",
  "sex",
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
    const { id } = await context.params;
    const rowId = Number.parseInt(id, 10);

    if (!Number.isFinite(rowId) || rowId <= 0) {
      return NextResponse.json({ message: "Invalid patient id" }, { status: 400 });
    }

    const body = (await request.json()) as UpdateBody;
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of ALLOWED_FIELDS) {
      const raw = body[field];
      if (typeof raw === "string") {
        values.push(raw.trim());
        updates.push(`${field} = $${values.length}`);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: "No update fields provided" }, { status: 400 });
    }

    values.push(rowId);
    const sql = `
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
        pdx,
        ext_dx
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
