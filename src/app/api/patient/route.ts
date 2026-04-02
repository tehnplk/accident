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
    const area = params.get("area")?.trim() ?? "";
    const vehicle = params.get("vehicle")?.trim() ?? "";
    const sex = params.get("sex")?.trim() ?? "";
    const sortBy =
      params.get("sortBy") === "visit_date_time"
        ? "visit_date_time"
        : params.get("sortBy") === "age"
          ? "age"
          : "visit_date";
    const sortDir = params.get("sortDir") === "asc" ? "asc" : "desc";

    const page = parsePage(params.get("page"), 1);
    const pageSizeRaw = parsePage(params.get("pageSize"), 20);
    const pageSize = PAGE_SIZES.has(pageSizeRaw) ? pageSizeRaw : 20;
    const offset = (page - 1) * pageSize;

    const whereParts: string[] = [];
    const values: unknown[] = [];

    if (hospital) {
      values.push(`%${hospital}%`);
      whereParts.push(`p.hosname ILIKE $${values.length}`);
    }
    if (name) {
      values.push(`%${name}%`);
      whereParts.push(`p.patient_name ILIKE $${values.length}`);
    }
    if (hn) {
      values.push(`%${hn}%`);
      whereParts.push(`p.hn ILIKE $${values.length}`);
    }
    if (area) {
      values.push(area);
      whereParts.push(`loc.area = $${values.length}`);
    }
    if (vehicle) {
      values.push(vehicle);
      whereParts.push(`detail.vehicle = $${values.length}`);
    }
    if (sex) {
      values.push(sex);
      whereParts.push(`p.sex = $${values.length}`);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
    const baseFrom = `
      FROM public.patient p
      LEFT JOIN LATERAL (
        SELECT COALESCE(NULLIF(pd.acd_vihicle_addon, ''), av.name) AS vehicle
        FROM public.patient_detail pd
        LEFT JOIN public.acd_vihicle av ON av.code = pd.acd_vihicle
        WHERE pd.patient_id = p.id
        LIMIT 1
      ) detail ON TRUE
      LEFT JOIN LATERAL (
        SELECT d.name_in_thai AS area
        FROM public.patient_acd_location l
        LEFT JOIN public.districts d ON d.code::text = l.amp_code
        WHERE l.patient_id = p.id
        ORDER BY l.id DESC
        LIMIT 1
      ) loc ON TRUE
    `;
    const orderBy =
      sortBy === "visit_date_time"
        ? `p.visit_date ${sortDir.toUpperCase()}, p.visit_time ${sortDir.toUpperCase()}, p.id ${sortDir.toUpperCase()}`
        : sortBy === "age"
          ? `p.age ${sortDir.toUpperCase()} NULLS LAST, p.id ${sortDir.toUpperCase()}`
          : `p.visit_date ${sortDir.toUpperCase()}, p.id ${sortDir.toUpperCase()}`;

    const countQuery = `SELECT count(*)::int AS total ${baseFrom} ${whereClause}`;
    const countResult = await dbQuery<{ total: number }>(countQuery, values);
    const total = countResult.rows[0]?.total ?? 0;

    const pageValues = [...values, pageSize, offset];
    const dataQuery = `
      SELECT
        p.id,
        p.hoscode,
        p.hosname,
        p.hn,
        p.cid,
        p.patient_name,
        p.visit_date,
        p.visit_time,
        p.sex,
        p.age,
        p.house_no,
        p.moo,
        p.road,
        p.tumbon,
        p.amphoe,
        p.changwat,
        p.cc,
        p.status,
        p.triage,
        p.pdx,
        p.ext_dx,
        detail.vehicle AS vehicle,
        loc.area AS area
      ${baseFrom}
      ${whereClause}
      ORDER BY ${orderBy}
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
