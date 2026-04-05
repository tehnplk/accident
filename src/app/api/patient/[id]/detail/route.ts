import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { patientApiAuthorized } from "@/lib/patient-security";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type DetailPayload = {
  detail?: Record<string, unknown>;
  acd_type?: unknown;
  acd_type_addon?: unknown;
  acd_vihicle?: unknown;
  acd_vihicle_addon?: unknown;
  acd_vihicle_counterpart?: unknown;
  acd_vihicle_counterpart_addon?: unknown;
  acd_road?: unknown;
  acd_road_addon?: unknown;
  acd_measure?: unknown;
  acd_measure_addon?: unknown;
  acd_transfer?: unknown;
  acd_transfer_addon?: unknown;
  acd_result?: unknown;
  acd_result_addon?: unknown;
  acd_refer?: unknown;
  acd_refer_addon?: unknown;
};

function toNullableSmallInt(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableText(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function isBlank(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

const COLUMNS = [
  "acd_type",
  "acd_type_addon",
  "acd_vihicle",
  "acd_vihicle_addon",
  "acd_road",
  "acd_road_addon",
  "acd_measure",
  "acd_measure_addon",
  "acd_transfer",
  "acd_transfer_addon",
  "acd_result",
  "acd_result_addon",
  "acd_refer",
  "acd_refer_addon",
] as const;

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    if (!patientApiAuthorized(_request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const patientId = Number.parseInt(id, 10);

    if (!Number.isFinite(patientId) || patientId <= 0) {
      return NextResponse.json({ message: "Invalid patient id" }, { status: 400 });
    }

    const result = await dbQuery<Record<string, unknown>>(
      `
        SELECT
          id,
          patient_id,
          acd_type,
          acd_type_addon,
          acd_vihicle,
          acd_vihicle_addon,
          acd_vihicle_counterpart,
          acd_vihicle_counterpart_addon,
          acd_road,
          acd_road_addon,
          acd_measure,
          acd_measure_addon,
          acd_transfer,
          acd_transfer_addon,
          acd_result,
          acd_result_addon,
          acd_refer,
          acd_refer_addon,
          created_at,
          updated_at
        FROM public.patient_detail
        WHERE patient_id = $1
        LIMIT 1
      `,
      [patientId],
    );

    return NextResponse.json({ row: result.rows[0] ?? null });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to load patient detail",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    if (!patientApiAuthorized(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const patientId = Number.parseInt(id, 10);

    if (!Number.isFinite(patientId) || patientId <= 0) {
      return NextResponse.json({ message: "Invalid patient id" }, { status: 400 });
    }

    const payload = (await request.json().catch(() => ({}))) as DetailPayload;
    const source = payload.detail ?? payload;

    const codes = {
      acd_type: toNullableSmallInt(source.acd_type),
      acd_vihicle: toNullableSmallInt(source.acd_vihicle),
      acd_road: toNullableSmallInt(source.acd_road),
      acd_measure: toNullableSmallInt(source.acd_measure),
      acd_transfer: toNullableSmallInt(source.acd_transfer),
      acd_result: toNullableSmallInt(source.acd_result),
      acd_refer: toNullableSmallInt(source.acd_refer),
    };

    const addons = {
      acd_type_addon: toNullableText(source.acd_type_addon),
      acd_vihicle_addon: toNullableText(source.acd_vihicle_addon),
      acd_road_addon: toNullableText(source.acd_road_addon),
      acd_measure_addon: toNullableText(source.acd_measure_addon),
      acd_transfer_addon: toNullableText(source.acd_transfer_addon),
      acd_result_addon: toNullableText(source.acd_result_addon),
      acd_refer_addon: toNullableText(source.acd_refer_addon),
    };

    const textFields = {
      acd_vihicle_counterpart: toNullableText(source.acd_vihicle_counterpart),
      acd_vihicle_counterpart_addon: toNullableText(source.acd_vihicle_counterpart_addon),
    };

    const hasAnyValue =
      Object.values(codes).some((value) => value !== null) ||
      Object.values(addons).some((value) => !isBlank(value)) ||
      Object.values(textFields).some((value) => !isBlank(value));

    if (!hasAnyValue) {
      await dbQuery("DELETE FROM public.patient_detail WHERE patient_id = $1", [patientId]);
      return NextResponse.json({ row: null, deleted: true });
    }

    const values = [
      patientId,
      codes.acd_type,
      addons.acd_type_addon,
      codes.acd_vihicle,
      addons.acd_vihicle_addon,
      textFields.acd_vihicle_counterpart,
      textFields.acd_vihicle_counterpart_addon,
      codes.acd_road,
      addons.acd_road_addon,
      codes.acd_measure,
      addons.acd_measure_addon,
      codes.acd_transfer,
      addons.acd_transfer_addon,
      codes.acd_result,
      addons.acd_result_addon,
      codes.acd_refer,
      addons.acd_refer_addon,
    ];

    const result = await dbQuery<Record<string, unknown>>(
      `
        INSERT INTO public.patient_detail (
          patient_id,
          acd_type,
          acd_type_addon,
          acd_vihicle,
          acd_vihicle_addon,
          acd_vihicle_counterpart,
          acd_vihicle_counterpart_addon,
          acd_road,
          acd_road_addon,
          acd_measure,
          acd_measure_addon,
          acd_transfer,
          acd_transfer_addon,
          acd_result,
          acd_result_addon,
          acd_refer,
          acd_refer_addon,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now()
        )
        ON CONFLICT (patient_id) DO UPDATE SET
          acd_type = EXCLUDED.acd_type,
          acd_type_addon = EXCLUDED.acd_type_addon,
          acd_vihicle = EXCLUDED.acd_vihicle,
          acd_vihicle_addon = EXCLUDED.acd_vihicle_addon,
          acd_vihicle_counterpart = EXCLUDED.acd_vihicle_counterpart,
          acd_vihicle_counterpart_addon = EXCLUDED.acd_vihicle_counterpart_addon,
          acd_road = EXCLUDED.acd_road,
          acd_road_addon = EXCLUDED.acd_road_addon,
          acd_measure = EXCLUDED.acd_measure,
          acd_measure_addon = EXCLUDED.acd_measure_addon,
          acd_transfer = EXCLUDED.acd_transfer,
          acd_transfer_addon = EXCLUDED.acd_transfer_addon,
          acd_result = EXCLUDED.acd_result,
          acd_result_addon = EXCLUDED.acd_result_addon,
          acd_refer = EXCLUDED.acd_refer,
          acd_refer_addon = EXCLUDED.acd_refer_addon,
          updated_at = now()
        RETURNING *
      `,
      values,
    );

    return NextResponse.json({ row: result.rows[0] ?? null });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to save patient detail",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}

// COLUMNS is kept for reference but not currently used in GET/PUT directly
void COLUMNS;
