import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

type IcdLookupRow = {
  code: string;
  name: string | null;
  ord: number;
};

function normalizeCodes(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const code = value.trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    output.push(code);
  }

  return output;
}

export async function GET(request: NextRequest) {
  try {
    const codes = normalizeCodes(request.nextUrl.searchParams.getAll("code"));
    if (codes.length === 0) {
      return NextResponse.json({ rows: [] });
    }

    const rows = await dbQuery<IcdLookupRow>(
      `
        WITH requested AS (
          SELECT code, ord
          FROM unnest($1::text[]) WITH ORDINALITY AS t(code, ord)
        )
        SELECT
          requested.code,
          COALESCE(NULLIF(i.tname, ''), i.name) AS name,
          requested.ord::int AS ord
        FROM requested
        LEFT JOIN public.icd101 i ON i.code = requested.code
        ORDER BY requested.ord
      `,
      [codes],
    );

    return NextResponse.json({
      rows: rows.rows.map((row) => ({
        code: row.code,
        name: row.name,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to lookup ICD",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
