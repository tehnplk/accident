import { auth } from "@/authConfig";
import { UserDataGrid, type UserGridRow } from "@/components/user-data-grid";
import { dbQuery } from "@/lib/db";
import { logActivity, parseProfileFromSession, sessionHasExportAccess } from "@/lib/activity-log";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function loadUsers() {
  const result = await dbQuery<UserGridRow>(`
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

  return result.rows;
}

export default async function UsersPage() {
  const session = await auth();
  const profile = parseProfileFromSession(session);

  if (!session?.user) {
    redirect("/login");
  }

  if (!sessionHasExportAccess(profile)) {
    redirect("/");
  }

  if (profile) {
    const fullName =
      [profile.title_th, profile.firstname_th, profile.lastname_th].filter(Boolean).join("") ||
      profile.name_th ||
      null;

    let department: string | null = null;
    const orgRaw = profile.organization;
    if (Array.isArray(orgRaw) && orgRaw.length > 0) {
      department = orgRaw
        .map((item: unknown) => {
          const value = typeof item === "string" ? JSON.parse(item) : item;
          return value?.hname_th ?? null;
        })
        .filter(Boolean)
        .join(" | ") || null;
    } else if (typeof orgRaw === "string") {
      department = orgRaw;
    }

    await logActivity({
      providerId: profile.provider_id ?? profile.account_id ?? profile.username ?? "unknown",
      fullName: fullName || profile.username || null,
      department: department || profile.hname_th || null,
      route: "/users",
    });
  }

  const rows = await loadUsers();
  return <UserDataGrid initialRows={rows} userName={session?.user?.name ?? null} />;
}
