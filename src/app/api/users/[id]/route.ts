import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/authConfig";
import { dbQuery } from "@/lib/db";
import { parseProfileFromSession, sessionHasExportAccess } from "@/lib/activity-log";

type UpdateUserBody = {
  username?: unknown;
  password?: unknown;
  hcode?: unknown;
  hname?: unknown;
  is_active?: unknown;
  not_hospital?: unknown;
};

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

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await ensureAuthorized();
    if (!access.authenticated) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!access.allowed) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const userId = Number.parseInt(id, 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ message: "Invalid user id" }, { status: 400 });
    }

    const body = (await request.json()) as UpdateUserBody;
    const updates: string[] = [];
    const values: unknown[] = [];

    if (Object.prototype.hasOwnProperty.call(body, "username")) {
      const username = normalizeText(body.username);
      if (!username) {
        return NextResponse.json({ message: "Username is required" }, { status: 400 });
      }
      values.push(username);
      updates.push(`username = $${values.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(body, "password")) {
      const password = normalizeText(body.password);
      if (password) {
        values.push(password);
        updates.push(`password_hash = crypt($${values.length}, gen_salt('bf', 10))`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "hcode")) {
      const hcode = normalizeText(body.hcode);
      if (!hcode) {
        return NextResponse.json({ message: "Hospital code is required" }, { status: 400 });
      }
      values.push(hcode);
      updates.push(`hcode = $${values.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(body, "hname")) {
      values.push(normalizeText(body.hname));
      updates.push(`hname = $${values.length}`);
    }

    if (typeof body.is_active === "boolean") {
      values.push(body.is_active);
      updates.push(`is_active = $${values.length}`);
    }

    if (typeof body.not_hospital === "boolean") {
      values.push(body.not_hospital);
      updates.push(`not_hospital = $${values.length}`);
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: "No update fields provided" }, { status: 400 });
    }

    updates.push(`updated_at = now()`);
    values.push(userId);

    const result = await dbQuery<UserRow>(
      `
        UPDATE public.users
        SET ${updates.join(", ")}
        WHERE id = $${values.length}
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
      values,
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ row: result.rows[0] });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "23505") {
      return NextResponse.json({ message: "Username already exists" }, { status: 409 });
    }

    return NextResponse.json(
      {
        message: "Failed to update user",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await ensureAuthorized();
    if (!access.authenticated) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!access.allowed) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const userId = Number.parseInt(id, 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ message: "Invalid user id" }, { status: 400 });
    }

    const result = await dbQuery<{ id: number }>(
      `
        DELETE FROM public.users
        WHERE id = $1
        RETURNING id
      `,
      [userId],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to delete user",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
