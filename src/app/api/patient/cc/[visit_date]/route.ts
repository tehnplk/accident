import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { patientApiAuthorized } from "@/lib/patient-security";

type PatientCcRow = {
  id: number;
  visit_date: string;
  visit_time: string;
  pdx: string;
  cc: string;
  is_rejected: boolean;
};

function isValidVisitDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;

  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export async function GET(_request: NextRequest, context: { params: Promise<{ visit_date: string }> }) {
  try {
    if (!patientApiAuthorized(_request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { visit_date: visitDate } = await context.params;

    if (!isValidVisitDate(visitDate)) {
      return NextResponse.json({ message: "Invalid visit_date. Use YYYY-MM-DD" }, { status: 400 });
    }

    const result = await dbQuery<PatientCcRow>(
      `
        SELECT
          p.id,
          to_char(p.visit_date, 'YYYY-MM-DD') AS visit_date,
          to_char(p.visit_time, 'HH24:MI:SS') AS visit_time,
          COALESCE(p.pdx, '') AS pdx,
          COALESCE(p.cc, '') AS cc,
          COALESCE(p.is_rejected, false) AS is_rejected
        FROM public.patient p
        WHERE p.visit_date = $1::date
          AND COALESCE(p.is_rejected, false) = false
          AND NOT EXISTS (
            SELECT 1
            FROM public.patient_expect_not_accident pena
            WHERE pena.patient_id = p.id
          )
        ORDER BY p.visit_time ASC NULLS LAST, p.id ASC
      `,
      [visitDate],
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to load patient cc rows",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
