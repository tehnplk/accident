import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

type CreatePatientDrunkBody = {
  hoscode?: unknown;
  patient_id?: unknown;
  visit_date?: unknown;
  cc_pi?: unknown;
};

type PatientDrunkRow = {
  id: number;
  hoscode: string;
  patient_id: number;
  visit_date: string;
  cc_pi: string;
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
    const hoscode = normalizeText(body.hoscode);
    const patientId = parsePatientId(body.patient_id);
    const visitDate = normalizeText(body.visit_date);
    const ccPi = normalizeText(body.cc_pi);

    if (!hoscode) {
      return NextResponse.json({ message: "hoscode is required" }, { status: 400 });
    }

    if (!patientId) {
      return NextResponse.json({ message: "patient_id is required" }, { status: 400 });
    }

    if (!visitDate) {
      return NextResponse.json({ message: "visit_date is required" }, { status: 400 });
    }

    if (!ccPi) {
      return NextResponse.json({ message: "cc_pi is required" }, { status: 400 });
    }

    const result = await dbQuery<PatientDrunkRow>(
      `
        INSERT INTO public.patient_drunk (
          id,
          hoscode,
          patient_id,
          visit_date,
          cc_pi
        )
        VALUES (DEFAULT, $1, $2, $3, $4)
        ON CONFLICT (hoscode, patient_id, visit_date) DO UPDATE
        SET
          cc_pi = EXCLUDED.cc_pi
        RETURNING
          id,
          hoscode,
          patient_id,
          visit_date::text AS visit_date,
          cc_pi
      `,
      [hoscode, patientId, visitDate, ccPi],
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
