import "server-only";

import { dbQuery } from "@/lib/db";

export const DASHBOARD_VIEW_COOKIE = "dashboard-view-counted";
export const DASHBOARD_VIEW_WINDOW_SECONDS = 60 * 5;

function normalizeIp(ip: string | null | undefined) {
  const text = ip?.trim() || "unknown";
  return text.slice(0, 120);
}

export function getClientIpFromHeaders(headerList: Headers) {
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor
      .split(",")
      .map((item) => item.trim())
      .find(Boolean);

    if (firstIp) return normalizeIp(firstIp);
  }

  return normalizeIp(headerList.get("x-real-ip"));
}

export async function recordDashboardView(ip: string) {
  await dbQuery(
    `INSERT INTO public.view_count (ip, datetime)
     VALUES ($1, NOW())`,
    [normalizeIp(ip)],
  );
}

export async function getDashboardViewCount() {
  const result = await dbQuery<{ total: number }>(
    `SELECT count(*)::int AS total
     FROM public.view_count`,
  );

  return Number(result.rows[0]?.total) || 0;
}
