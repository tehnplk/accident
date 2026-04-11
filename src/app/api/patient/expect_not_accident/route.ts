import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

type CreatePatientExpectNotAccidentBody = {
  patient_id?: unknown;
  cc_pi?: unknown;
  reason?: unknown;
};

type PatientExpectNotAccidentRow = {
  id: number;
  patient_id: number;
  cc_pi: string;
  reason: string;
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
    const body = (await request.json()) as CreatePatientExpectNotAccidentBody;
    const patientId = parsePatientId(body.patient_id);
    const ccPi = normalizeText(body.cc_pi);
    const reason = normalizeText(body.reason);

    if (!patientId) {
      return NextResponse.json({ message: "patient_id is required" }, { status: 400 });
    }

    if (!ccPi) {
      return NextResponse.json({ message: "cc_pi is required" }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ message: "reason is required" }, { status: 400 });
    }

    const result = await dbQuery<PatientExpectNotAccidentRow>(
      `
        INSERT INTO public.patient_expect_not_accident (
          id,
          patient_id,
          cc_pi,
          reason
        )
        VALUES (DEFAULT, $1, $2, $3)
        ON CONFLICT (patient_id) DO UPDATE
        SET
          cc_pi = EXCLUDED.cc_pi,
          reason = EXCLUDED.reason
        RETURNING
          id,
          patient_id,
          cc_pi,
          reason
      `,
      [patientId, ccPi, reason],
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
        message: "Failed to create patient_expect_not_accident row",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
