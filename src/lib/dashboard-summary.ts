import "server-only";

import { dbQuery } from "@/lib/db";

export type DashboardSegment = {
  label: string;
  value: number;
  color: string;
};

export type DashboardBarRow = {
  district: string;
  cases: number;
  deaths: number;
};

export type DashboardLinePoint = {
  label: string;
  value: number;
};

export type DashboardSummary = {
  totalCases: number;
  deathCases: number;
  minVisitDate: string | null;
  maxVisitDate: string | null;
  statusSegments: DashboardSegment[];
  alcoholSegments: DashboardSegment[];
  vehicleSegments: DashboardSegment[];
  districtRows: DashboardBarRow[];
  dailyCases: DashboardLinePoint[];
};

type LabelCountRow = {
  label: string | null;
  value: number;
};

type DistrictCountRow = {
  district: string | null;
  cases: number;
  deaths: number;
};

type DailyCountRow = {
  day: string;
  value: number;
};

const STATUS_COLORS: Record<string, string> = {
  "กลับบ้าน": "#475569",
  "รับไว้รักษา": "#2563eb",
  "เสียชีวิต": "#b91c1c",
  "ไม่ระบุ": "#94a3b8",
};

const ALCOHOL_COLORS: Record<string, string> = {
  "ไม่ดื่ม": "#334155",
  ดื่ม: "#b45309",
  "ไม่ระบุ": "#94a3b8",
};

const VEHICLE_PALETTE = [
  "#1e3a8a",
  "#475569",
  "#0f766e",
  "#64748b",
  "#0284c7",
  "#cbd5e1",
];

const OTHER_COLOR = "#94a3b8";

function normalizeLabel(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text || "ไม่ระบุ";
}

function makeSegment(row: LabelCountRow, index: number, palette: string[]) {
  return {
    label: normalizeLabel(row.label),
    value: Number(row.value) || 0,
    color: palette[index] ?? OTHER_COLOR,
  };
}

function withOtherBucket<T>(
  rows: T[],
  limit: number,
  getValue: (row: T) => number,
  createOther: (value: number) => T,
) {
  if (rows.length <= limit) return rows;

  const visible = rows.slice(0, limit);
  const otherValue = rows.slice(limit).reduce((sum, row) => sum + (Number(getValue(row)) || 0), 0);
  return [...visible, createOther(otherValue)];
}

export async function loadDashboardSummary(): Promise<DashboardSummary> {
  const totalResult = await dbQuery<{ total: number; death_cases: number }>(
    `SELECT
       count(*)::int AS total,
       count(*) FILTER (
         WHERE COALESCE(status, '') LIKE '%เสียชีวิต%'
            OR COALESCE(status, '') LIKE '%ตาย%'
       )::int AS death_cases
     FROM public.patient
     WHERE COALESCE(is_rejected, false) = false`,
  );

  const rangeResult = await dbQuery<{ min_visit_date: string | null; max_visit_date: string | null }>(
    `SELECT
       to_char(min(visit_date), 'YYYY-MM-DD') AS min_visit_date,
       to_char(max(visit_date), 'YYYY-MM-DD') AS max_visit_date
     FROM public.patient
     WHERE COALESCE(is_rejected, false) = false`,
  );

  const [statusResult, alcoholResult, vehicleResult, districtResult] = await Promise.all([
    dbQuery<LabelCountRow>(
      `SELECT
         COALESCE(NULLIF(status, ''), 'ไม่ระบุ') AS label,
         count(*)::int AS value
       FROM public.patient
       WHERE COALESCE(is_rejected, false) = false
       GROUP BY 1
       ORDER BY value DESC, label ASC`,
    ),
    dbQuery<LabelCountRow>(
      `SELECT
         CASE
           WHEN alcohol = 1 THEN 'ดื่ม'
           WHEN alcohol = 0 THEN 'ไม่ดื่ม'
           ELSE 'ไม่ระบุ'
         END AS label,
         count(*)::int AS value
       FROM public.patient
       WHERE COALESCE(is_rejected, false) = false
       GROUP BY 1
       ORDER BY value DESC, label ASC`,
    ),
    dbQuery<LabelCountRow>(
      `SELECT
         COALESCE(NULLIF(av.name, ''), NULLIF(detail.acd_vihicle_addon, ''), detail.acd_vihicle::text, 'ไม่ระบุ') AS label,
         count(*)::int AS value
       FROM public.patient_detail detail
       JOIN public.patient p ON p.id = detail.patient_id
       LEFT JOIN public.acd_vihicle av ON av.code = detail.acd_vihicle
       WHERE COALESCE(p.is_rejected, false) = false
       GROUP BY 1
       ORDER BY value DESC, label ASC`,
    ),
    dbQuery<DistrictCountRow>(
      `SELECT
         COALESCE(NULLIF(loc.district_name, ''), NULLIF(p.amphoe, ''), 'ไม่ระบุ') AS district,
         count(*)::int AS cases,
         count(*) FILTER (
           WHERE COALESCE(p.status, '') LIKE '%เสียชีวิต%'
              OR COALESCE(p.status, '') LIKE '%ตาย%'
         )::int AS deaths
       FROM public.patient p
        LEFT JOIN LATERAL (
          SELECT d.name_in_thai AS district_name
          FROM public.patient_acd_location l
          LEFT JOIN public.districts d ON d.code::text = l.amp_code
          WHERE l.patient_id = p.id
          ORDER BY l.id DESC
          LIMIT 1
        ) loc ON TRUE
       WHERE COALESCE(p.is_rejected, false) = false
       GROUP BY 1
       ORDER BY cases DESC, district ASC`,
    ),
  ]);

  let dailyCases: DashboardLinePoint[] = [];
  const minVisitDate = rangeResult.rows[0]?.min_visit_date ?? null;
  const maxVisitDate = rangeResult.rows[0]?.max_visit_date ?? null;

  if (minVisitDate && maxVisitDate) {
    const dailyResult = await dbQuery<DailyCountRow>(
      `WITH bounds AS (
         SELECT $1::date AS min_date, $2::date AS max_date
       ),
       series AS (
         SELECT generate_series(bounds.min_date, bounds.max_date, interval '1 day')::date AS day
         FROM bounds
       )
       SELECT
         to_char(series.day, 'YYYY-MM-DD') AS day,
         count(p.id)::int AS value
       FROM series
       LEFT JOIN public.patient p
         ON p.visit_date::date = series.day
        AND COALESCE(p.is_rejected, false) = false
       GROUP BY series.day
       ORDER BY series.day`,
      [minVisitDate, maxVisitDate],
    );

    dailyCases = dailyResult.rows.map((row) => ({
      label: row.day,
      value: Number(row.value) || 0,
    }));
  }

  const statusSegments = statusResult.rows.map((row, index) => ({
    ...makeSegment(row, index, Object.values(STATUS_COLORS)),
    color: STATUS_COLORS[normalizeLabel(row.label)] ?? Object.values(STATUS_COLORS)[index] ?? OTHER_COLOR,
  }));

  const alcoholSegments = alcoholResult.rows.map((row, index) => ({
    ...makeSegment(row, index, Object.values(ALCOHOL_COLORS)),
    color: ALCOHOL_COLORS[normalizeLabel(row.label)] ?? Object.values(ALCOHOL_COLORS)[index] ?? OTHER_COLOR,
  }));

  const vehicleSegments = withOtherBucket(
    vehicleResult.rows.map((row, index) => makeSegment(row, index, VEHICLE_PALETTE)),
    5,
    (row) => row.value,
    (value) => ({
      label: "อื่น ๆ",
      value,
      color: OTHER_COLOR,
    }),
  );

  const districtRows = withOtherBucket(
    districtResult.rows.map((row) => ({
      district: normalizeLabel(row.district),
      cases: Number(row.cases) || 0,
      deaths: Number(row.deaths) || 0,
    })),
    5,
    (row) => row.cases,
    (cases) => ({
      district: "อื่น ๆ",
      cases,
      deaths: 0,
    }),
  );

  return {
    totalCases: Number(totalResult.rows[0]?.total) || 0,
    deathCases: Number(totalResult.rows[0]?.death_cases) || 0,
    minVisitDate,
    maxVisitDate,
    statusSegments,
    alcoholSegments,
    vehicleSegments,
    districtRows,
    dailyCases,
  };
}
