import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { patientApiAuthorized } from "@/lib/patient-security";

type IcdRow = {
  code: string;
  name: string | null;
};

function normalizeQuery(value: string | null) {
  return (value ?? "").trim();
}

export async function GET(request: NextRequest) {
  try {
    if (!patientApiAuthorized(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const q = normalizeQuery(request.nextUrl.searchParams.get("q"));
    const type = normalizeQuery(request.nextUrl.searchParams.get("type")).toLowerCase();

    if (q.length < 2) {
      return NextResponse.json({ rows: [] });
    }

    const sourceTable = type === "ext" ? "icd10_v" : "icd101";
    const sourceExists = await dbQuery<{ exists: string | null }>(
      "SELECT to_regclass($1) AS exists",
      [`public.${sourceTable}`],
    );
    const tableName = sourceExists.rows[0]?.exists ? sourceTable : "icd101";

    const codeSearch = `${q}%`;
    const nameSearch = `%${q}%`;

    const rows = await dbQuery<IcdRow>(
      `
        SELECT code, COALESCE(NULLIF(tname, ''), name) AS name
        FROM public.${tableName}
        WHERE code ILIKE $1 OR name ILIKE $2 OR tname ILIKE $2
        ORDER BY
          CASE WHEN code ILIKE $1 THEN 0 ELSE 1 END,
          code
        LIMIT 20
      `,
      [codeSearch, nameSearch],
    );

    return NextResponse.json({ rows: rows.rows });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to search ICD",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
