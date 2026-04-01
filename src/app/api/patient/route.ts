import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

const PAGE_SIZES = new Set([20, 50, 100]);

function parsePage(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const hospital = params.get("hospital")?.trim() ?? "";
    const name = params.get("name")?.trim() ?? "";
    const hn = params.get("hn")?.trim() ?? "";
    const sex = params.get("sex")?.trim() ?? "";

    const page = parsePage(params.get("page"), 1);
    const pageSizeRaw = parsePage(params.get("pageSize"), 20);
    const pageSize = PAGE_SIZES.has(pageSizeRaw) ? pageSizeRaw : 20;
    const offset = (page - 1) * pageSize;

    const whereParts: string[] = [];
    const values: unknown[] = [];

    if (hospital) {
      values.push(`%${hospital}%`);
      whereParts.push(`hosname ILIKE $${values.length}`);
    }
    if (name) {
      values.push(`%${name}%`);
      whereParts.push(`patient_name ILIKE $${values.length}`);
    }
    if (hn) {
      values.push(`%${hn}%`);
      whereParts.push(`hn ILIKE $${values.length}`);
    }
    if (sex) {
      values.push(sex);
      whereParts.push(`sex = $${values.length}`);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const countQuery = `SELECT count(*)::int AS total FROM public.patient ${whereClause}`;
    const countResult = await dbQuery<{ total: number }>(countQuery, values);
    const total = countResult.rows[0]?.total ?? 0;

    const pageValues = [...values, pageSize, offset];
    const dataQuery = `
      SELECT
        id,
        hoscode,
        hosname,
        hn,
        patient_name,
        dateserv,
        sex,
        age,
        status,
        triage,
        pdx,
        ext_dx
      FROM public.patient
      ${whereClause}
      ORDER BY dateserv DESC, id DESC
      LIMIT $${pageValues.length - 1}
      OFFSET $${pageValues.length}
    `;

    const rowsResult = await dbQuery(dataQuery, pageValues);

    return NextResponse.json({
      page,
      pageSize,
      total,
      rows: rowsResult.rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to load patient list",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
