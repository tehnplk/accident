import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/authConfig";
import { dbQuery } from "@/lib/db";
import { parseProfileFromSession, sessionHasExportAccess } from "@/lib/activity-log";

type UserRow = {
  id: number;
  username: string;
  hcode: string;
  hname: string;
  is_active: boolean;
  not_hospital: boolean;
  created_at: string;
  updated_at: string;
};

type CreateUserBody = {
  username?: unknown;
  password?: unknown;
  hcode?: unknown;
  hname?: unknown;
  is_active?: unknown;
  not_hospital?: unknown;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

async function ensureAuthorized() {
  const session = await auth();
  if (!session?.user) {
    return { authenticated: false, allowed: false };
  }

  const profile = parseProfileFromSession(session);
  return {
    authenticated: true,
    allowed: sessionHasExportAccess(profile),
  };
}

export async function GET() {
  try {
    const access = await ensureAuthorized();
    if (!access.authenticated) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!access.allowed) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const result = await dbQuery<UserRow>(`
      SELECT
        id,
        username,
        hcode,
        hname,
        is_active,
        COALESCE(not_hospital, false) AS not_hospital,
        to_char(created_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS') AS created_at,
        to_char(updated_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS') AS updated_at
      FROM public.users
      ORDER BY id DESC
    `);

    return NextResponse.json({ rows: result.rows });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to load users",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await ensureAuthorized();
    if (!access.authenticated) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!access.allowed) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as CreateUserBody;
    const username = normalizeText(body.username);
    const password = normalizeText(body.password);
    const hcode = normalizeText(body.hcode);
    const hname = normalizeText(body.hname);
    const isActive = normalizeBoolean(body.is_active, true);
    const notHospital = normalizeBoolean(body.not_hospital, false);

    if (!username) {
      return NextResponse.json({ message: "Username is required" }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ message: "Password is required" }, { status: 400 });
    }

    if (!hcode) {
      return NextResponse.json({ message: "Hospital code is required" }, { status: 400 });
    }

    const result = await dbQuery<UserRow>(
      `
        INSERT INTO public.users (
          username,
          password_hash,
          hcode,
          hname,
          is_active,
          not_hospital
        )
        VALUES (
          $1,
          crypt($2, gen_salt('bf', 10)),
          $3,
          $4,
          $5,
          $6
        )
        RETURNING
          id,
          username,
          hcode,
          hname,
          is_active,
          COALESCE(not_hospital, false) AS not_hospital,
          to_char(created_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS') AS created_at,
          to_char(updated_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS') AS updated_at
      `,
      [username, password, hcode, hname, isActive, notHospital],
    );

    return NextResponse.json({ row: result.rows[0] }, { status: 201 });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "23505") {
      return NextResponse.json({ message: "Username already exists" }, { status: 409 });
    }

    return NextResponse.json(
      {
        message: "Failed to create user",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
