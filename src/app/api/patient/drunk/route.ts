import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

type CreatePatientDrunkBody = {
  patient_id?: unknown;
  cc_pi?: unknown;
  visit_date_time?: unknown;
};

type PatientDrunkRow = {
  id: number;
  patient_id: number;
  cc_pi: string;
  visit_date_time: string;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePatientId(value: unknown) {
  const normalized = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreatePatientDrunkBody;
    const patientId = parsePatientId(body.patient_id);
    const ccPi = normalizeText(body.cc_pi);
    const visitDateTime = normalizeText(body.visit_date_time);

    if (!patientId) {
      return NextResponse.json({ message: "patient_id is required" }, { status: 400 });
    }

    if (!ccPi) {
      return NextResponse.json({ message: "cc_pi is required" }, { status: 400 });
    }

    if (!visitDateTime) {
      return NextResponse.json({ message: "visit_date_time is required" }, { status: 400 });
    }

    const result = await dbQuery<PatientDrunkRow>(
      `
        INSERT INTO public.patient_drunk (
          id,
          patient_id,
          cc_pi,
          visit_date_time
        )
        VALUES (DEFAULT, $1, $2, $3)
        ON CONFLICT (patient_id) DO UPDATE
        SET
          cc_pi = EXCLUDED.cc_pi,
          visit_date_time = EXCLUDED.visit_date_time
        RETURNING
          id,
          patient_id,
          cc_pi,
          visit_date_time
      `,
      [patientId, ccPi, visitDateTime],
    );

    return NextResponse.json({ row: result.rows[0] });
  } catch (error) {
    const code = (error as { code?: string })?.code;

    if (code === "23503") {
      return NextResponse.json({ message: "patient_id was not found" }, { status: 404 });
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    return NextResponse.json(
      {
        message: "Failed to create patient_drunk row",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
