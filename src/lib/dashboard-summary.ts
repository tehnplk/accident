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

export type DashboardLastSyncRow = {
  hoscode: string;
  hosname: string;
  dateTimeSync: string;
  rows: number;
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
  lastSyncRows: DashboardLastSyncRow[];
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

type LastSyncRow = {
  hoscode: string | null;
  hosname: string | null;
  date_time_sync: string | null;
  num_pt_case: number | null;
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
const DASHBOARD_MIN_VISIT_DATE = "2026-04-10";
const DASHBOARD_MAX_VISIT_DATE = "2026-04-16";

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
         WHERE COALESCE(confirm_dead.has_confirm_dead, false)
       )::int AS death_cases
     FROM public.patient p
     LEFT JOIN LATERAL (
       SELECT true AS has_confirm_dead
       FROM public.patient_road_accident_confirm_dead pcd
       WHERE pcd.patient_id = p.id
       LIMIT 1
     ) confirm_dead ON TRUE
     WHERE COALESCE(p.is_rejected, false) = false
       AND p.visit_date BETWEEN DATE '${DASHBOARD_MIN_VISIT_DATE}' AND DATE '${DASHBOARD_MAX_VISIT_DATE}'`,
  );

  const rangeResult = await dbQuery<{ min_visit_date: string | null; max_visit_date: string | null }>(
    `SELECT
       '${DASHBOARD_MIN_VISIT_DATE}'::text AS min_visit_date,
       '${DASHBOARD_MAX_VISIT_DATE}'::text AS max_visit_date`,
  );

  const [statusResult, alcoholResult, vehicleResult, districtResult, lastSyncResult] = await Promise.all([
    dbQuery<LabelCountRow>(
      `SELECT
         CASE
           WHEN COALESCE(confirm_dead.has_confirm_dead, false) THEN 'เสียชีวิต'
           ELSE COALESCE(NULLIF(p.status, ''), 'ไม่ระบุ')
         END AS label,
         count(*)::int AS value
       FROM public.patient p
       LEFT JOIN LATERAL (
         SELECT true AS has_confirm_dead
         FROM public.patient_road_accident_confirm_dead pcd
         WHERE pcd.patient_id = p.id
         LIMIT 1
       ) confirm_dead ON TRUE
       WHERE COALESCE(p.is_rejected, false) = false
         AND p.visit_date BETWEEN DATE '${DASHBOARD_MIN_VISIT_DATE}' AND DATE '${DASHBOARD_MAX_VISIT_DATE}'
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
         AND visit_date BETWEEN DATE '${DASHBOARD_MIN_VISIT_DATE}' AND DATE '${DASHBOARD_MAX_VISIT_DATE}'
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
         AND p.visit_date BETWEEN DATE '${DASHBOARD_MIN_VISIT_DATE}' AND DATE '${DASHBOARD_MAX_VISIT_DATE}'
       GROUP BY 1
       ORDER BY value DESC, label ASC`,
    ),
    dbQuery<DistrictCountRow>(
      `SELECT
         COALESCE(NULLIF(loc.district_name, ''), 'ไม่ระบุ') AS district,
         count(*)::int AS cases,
         count(*) FILTER (
           WHERE COALESCE(confirm_dead.has_confirm_dead, false)
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
        LEFT JOIN LATERAL (
          SELECT true AS has_confirm_dead
          FROM public.patient_road_accident_confirm_dead pcd
          WHERE pcd.patient_id = p.id
          LIMIT 1
        ) confirm_dead ON TRUE
       WHERE COALESCE(p.is_rejected, false) = false
         AND p.visit_date BETWEEN DATE '${DASHBOARD_MIN_VISIT_DATE}' AND DATE '${DASHBOARD_MAX_VISIT_DATE}'
       GROUP BY 1
       ORDER BY cases DESC, district ASC`,
    ),
    dbQuery<LastSyncRow>(
      `WITH ranked AS (
         SELECT
           hoscode,
           hosname,
           date_time,
           num_pt_case,
           row_number() OVER (
             PARTITION BY hoscode
             ORDER BY date_time DESC, id DESC
           ) AS rn
         FROM public.sync_log
         WHERE hoscode IS NOT NULL
           AND trim(hoscode) <> ''
       )
       SELECT
         hoscode,
         COALESCE(NULLIF(hosname, ''), hoscode, '-') AS hosname,
         to_char(date_time AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS') AS date_time_sync,
         num_pt_case
       FROM ranked
       WHERE rn = 1
       ORDER BY date_time DESC, hosname ASC`,
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

  const normalizedDistrictRows = districtResult.rows.map((row) => ({
    district: normalizeLabel(row.district),
    cases: Number(row.cases) || 0,
    deaths: Number(row.deaths) || 0,
  }));

  const districtRows =
    normalizedDistrictRows.length <= 5
      ? normalizedDistrictRows
      : [
          ...normalizedDistrictRows.slice(0, 5),
          {
            district: "อื่น ๆ",
            cases: normalizedDistrictRows.slice(5).reduce((sum, row) => sum + row.cases, 0),
            deaths: normalizedDistrictRows.slice(5).reduce((sum, row) => sum + row.deaths, 0),
          },
        ];

  const lastSyncRows = lastSyncResult.rows.map((row) => ({
    hoscode: row.hoscode?.trim() || "-",
    hosname: row.hosname?.trim() || "-",
    dateTimeSync: row.date_time_sync?.trim() || "-",
    rows: Number(row.num_pt_case) || 0,
  }));

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
    lastSyncRows,
  };
}
