import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  DASHBOARD_VIEW_COOKIE,
  DASHBOARD_VIEW_WINDOW_SECONDS,
  getClientIpFromHeaders,
  getDashboardViewCount,
  recordDashboardView,
} from "@/lib/view-count";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const shouldCount = !cookieStore.get(DASHBOARD_VIEW_COOKIE)?.value;

  if (shouldCount) {
    await recordDashboardView(getClientIpFromHeaders(request.headers));
  }

  const response = NextResponse.json({
    counted: shouldCount,
    viewCount: await getDashboardViewCount(),
  });

  if (shouldCount) {
    response.cookies.set({
      name: DASHBOARD_VIEW_COOKIE,
      value: "1",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DASHBOARD_VIEW_WINDOW_SECONDS,
    });
  }

  return response;
}
