import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { patientApiAuthorized } from "@/lib/patient-security";

type LocationBody = {
  prov_code?: string;
  amp_code?: string;
  tmb_code?: string;
  moo?: string;
  road?: string;
  detail?: string;
};

type LocationRow = {
  id: number;
  patient_id: number;
  prov_code: string | null;
  amp_code: string | null;
  tmb_code: string | null;
  moo: string | null;
  road: string | null;
  detail: string | null;
  created_at: string;
  updated_at: string;
};

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePartCode(value: unknown, part: "province" | "district" | "subdistrict") {
  if (typeof value !== "string") return null;
  const digits = value.trim().replace(/\D/g, "");
  if (!digits) return null;

  if (part === "province") {
    if (digits.length >= 2) return digits.slice(0, 2);
    return digits;
  }

  if (part === "district") {
    if (digits.length >= 4) return digits.slice(0, 4);
    if (digits.length === 2) return digits;
    return null;
  }

  if (digits.length >= 6) return digits.slice(0, 6);
  if (digits.length === 4) return `${digits}01`;
  if (digits.length === 2) return `${digits}0101`;
  return null;
}

function parseId(rawId: string) {
  const parsed = Number.parseInt(rawId, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function fetchLatestLocation(patientId: number) {
  const result = await dbQuery<LocationRow>(
    `
      SELECT
        id,
        patient_id,
        prov_code,
        amp_code,
        tmb_code,
        moo,
        road,
        detail,
        created_at,
        updated_at
      FROM public.patient_acd_location
      WHERE patient_id = $1
      ORDER BY id DESC
      LIMIT 1
    `,
    [patientId],
  );

  return result.rows[0] ?? null;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!patientApiAuthorized(_request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const patientId = parseId(id);

    if (!patientId) {
      return NextResponse.json({ message: "Invalid patient id" }, { status: 400 });
    }

    const row = await fetchLatestLocation(patientId);
    return NextResponse.json({ row });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to load patient location",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!patientApiAuthorized(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const patientId = parseId(id);

    if (!patientId) {
      return NextResponse.json({ message: "Invalid patient id" }, { status: 400 });
    }

    const body = (await request.json()) as LocationBody;
    const values = [
      normalizePartCode(body.prov_code, "province"),
      normalizePartCode(body.amp_code, "district"),
      normalizePartCode(body.tmb_code, "subdistrict"),
      cleanText(body.moo),
      cleanText(body.road),
      cleanText(body.detail),
    ];

    const existing = await fetchLatestLocation(patientId);
    const saveValues = [...values, patientId];

    const query = existing
      ? `
        UPDATE public.patient_acd_location
        SET
          prov_code = $1,
          amp_code = $2,
          tmb_code = $3,
          moo = $4,
          road = $5,
          detail = $6,
          updated_at = now()
        WHERE id = $7
        RETURNING
          id,
          patient_id,
          prov_code,
          amp_code,
          tmb_code,
          moo,
          road,
          detail,
          created_at,
          updated_at
      `
      : `
        INSERT INTO public.patient_acd_location (
          prov_code,
          amp_code,
          tmb_code,
          moo,
          road,
          detail,
          patient_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          patient_id,
          prov_code,
          amp_code,
          tmb_code,
          moo,
          road,
          detail,
          created_at,
          updated_at
      `;

    const result = existing
      ? await dbQuery<LocationRow>(query, [...values, existing.id])
      : await dbQuery<LocationRow>(query, saveValues);

    return NextResponse.json({ row: result.rows[0] ?? null });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "23503") {
      return NextResponse.json({ message: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        message: "Failed to save patient location",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
