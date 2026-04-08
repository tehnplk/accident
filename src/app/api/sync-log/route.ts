import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

type SyncLogBody = {
  date_time?: string | null;
  hoscode?: string | null;
  hosname?: string | null;
  num_pt_case?: number | string | null;
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCount(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SyncLogBody;
    const numPtCase = normalizeCount(body.num_pt_case);

    if (numPtCase === null) {
      return NextResponse.json({ message: "num_pt_case must be a non-negative integer" }, { status: 400 });
    }

    const result = await dbQuery<{
      id: string;
      date_time: string;
      hoscode: string | null;
      hosname: string | null;
      num_pt_case: number;
    }>(
      `
        INSERT INTO public.sync_log (date_time, hoscode, hosname, num_pt_case)
        VALUES (COALESCE($1::timestamptz, now()), $2, $3, $4)
        RETURNING id, date_time, hoscode, hosname, num_pt_case
      `,
      [normalizeText(body.date_time), normalizeText(body.hoscode), normalizeText(body.hosname), numPtCase],
    );

    return NextResponse.json({ row: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to create sync log",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
