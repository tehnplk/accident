import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

type CreatePatientConfirmDeadBody = {
  patient_id?: unknown;
  patient_cc_pi?: unknown;
  patient_status?: unknown;
};

type PatientConfirmDeadRow = {
  id: number;
  patient_id: number;
  patient_cc_pi: string;
  patient_status: string;
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
    const body = (await request.json()) as CreatePatientConfirmDeadBody;
    const patientId = parsePatientId(body.patient_id);
    const patientCcPi = normalizeText(body.patient_cc_pi);
    const patientStatus = normalizeText(body.patient_status);

    if (!patientId) {
      return NextResponse.json({ message: "patient_id is required" }, { status: 400 });
    }

    if (!patientCcPi) {
      return NextResponse.json({ message: "patient_cc_pi is required" }, { status: 400 });
    }

    if (!patientStatus) {
      return NextResponse.json({ message: "patient_status is required" }, { status: 400 });
    }

    const result = await dbQuery<PatientConfirmDeadRow>(
      `
        INSERT INTO public.patient_road_accident_confirm_dead (
          id,
          patient_id,
          patient_cc_pi,
          patient_status
        )
        VALUES (DEFAULT, $1, $2, $3)
        ON CONFLICT (patient_id) DO UPDATE
        SET
          patient_cc_pi = EXCLUDED.patient_cc_pi,
          patient_status = EXCLUDED.patient_status
        RETURNING
          id,
          patient_id,
          patient_cc_pi,
          patient_status
      `,
      [patientId, patientCcPi, patientStatus],
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
        message: "Failed to create patient_road_accident_confirm_dead row",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
