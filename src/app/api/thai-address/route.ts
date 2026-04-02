import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

type AddressOption = {
  id: number;
  code: number;
  name: string | null;
  province_id?: number | null;
  district_id?: number | null;
};

function parseIntParam(value: string | null) {
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const LEVEL_QUERY: Record<string, { sql: string; values: (params: URLSearchParams) => unknown[] }> = {
  province: {
    sql: `
      SELECT id, code, name_in_thai AS name
      FROM public.provinces
      ORDER BY code ASC, id ASC
    `,
    values: () => [],
  },
  district: {
    sql: `
      SELECT id, code, name_in_thai AS name, province_id
      FROM public.districts
      WHERE province_id = $1
        AND name_in_thai NOT ILIKE 'เทศบาล%'
      ORDER BY code ASC, id ASC
    `,
    values: (params) => [parseIntParam(params.get("province_id"))],
  },
  subdistrict: {
    sql: `
      SELECT id, code, name_in_thai AS name, district_id
      FROM public.subdistricts
      WHERE district_id = $1
      ORDER BY code ASC, id ASC
    `,
    values: (params) => [parseIntParam(params.get("district_id"))],
  },
};

export async function GET(request: NextRequest) {
  try {
    const level = (request.nextUrl.searchParams.get("level") ?? "province").trim();
    const config = LEVEL_QUERY[level];

    if (!config) {
      return NextResponse.json({ message: "Invalid level" }, { status: 400 });
    }

    const rows = await dbQuery<AddressOption>(config.sql, config.values(request.nextUrl.searchParams));
    return NextResponse.json({ rows: rows.rows });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to load thai address options",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
