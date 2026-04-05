import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

const ACD_TABLES = [
  "acd_type",
  "acd_vihicle",
  "acd_road",
  "acd_measure",
  "acd_transfer",
  "acd_result",
  "acd_refer",
] as const;

export async function GET() {
  try {
    const unionParts = ACD_TABLES.map(
      (table) =>
        `SELECT '${table}'::text AS acd_name, code::smallint AS code, name, is_addon FROM public.${table}`,
    ).join(" UNION ALL ");

    const result = await dbQuery<{
      acd_name: string;
      code: number;
      name: string;
      is_addon: boolean;
    }>(
      `
        ${unionParts}
        ORDER BY acd_name, code
      `,
    );

    return NextResponse.json({ rows: result.rows });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to load acd options",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
