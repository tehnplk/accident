import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

type DefaultLocationRow = {
  province_id: number;
  province_code: number;
  province_name: string;
  district_id: number;
  district_code: number;
  district_name: string;
};

export async function GET() {
  try {
    const result = await dbQuery<DefaultLocationRow>(
      `
        WITH province AS (
          SELECT id, code, name_in_thai
          FROM public.provinces
          WHERE name_in_thai = 'พิษณุโลก'
          ORDER BY id ASC
          LIMIT 1
        ), district AS (
          SELECT d.id, d.code, d.name_in_thai, d.province_id
          FROM public.districts d
          JOIN province p ON p.id = d.province_id
          ORDER BY d.code ASC, d.id ASC
          LIMIT 1
        )
        SELECT
          p.id AS province_id,
          p.code AS province_code,
          p.name_in_thai AS province_name,
          d.id AS district_id,
          d.code AS district_code,
          d.name_in_thai AS district_name
        FROM province p
        JOIN district d ON TRUE
      `,
      [],
    );

    return NextResponse.json({ row: result.rows[0] ?? null });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to load default thai address",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
