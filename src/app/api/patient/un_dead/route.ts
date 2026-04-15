import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

type UndoPatientConfirmDeadBody = {
  patient_id?: unknown;
};

type DeletedPatientConfirmDeadRow = {
  id: number;
  patient_id: number;
  patient_cc_pi: string;
  patient_status: string;
};

function parsePatientId(value: unknown) {
  const normalized = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UndoPatientConfirmDeadBody;
    const patientId = parsePatientId(body.patient_id);

    if (!patientId) {
      return NextResponse.json({ message: "patient_id is required" }, { status: 400 });
    }

    const result = await dbQuery<DeletedPatientConfirmDeadRow>(
      `
        DELETE FROM public.patient_road_accident_confirm_dead
        WHERE patient_id = $1
        RETURNING
          id,
          patient_id,
          patient_cc_pi,
          patient_status
      `,
      [patientId],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ message: "Confirm-dead row not found" }, { status: 404 });
    }

    return NextResponse.json({ row: result.rows[0] });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    return NextResponse.json(
      {
        message: "Failed to remove patient_road_accident_confirm_dead row",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
