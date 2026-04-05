import { dbQuery } from "@/lib/db";
import type { Session } from "next-auth";

interface ActivityLogEntry {
  providerId: string;
  fullName: string | null;
  department: string | null;
  route: string;
}

export async function logActivity(entry: ActivityLogEntry) {
  try {
    await dbQuery(
      `INSERT INTO user_activity_log (provider_id, full_name, department, route)
       VALUES ($1, $2, $3, $4)`,
      [entry.providerId, entry.fullName, entry.department, entry.route]
    );
  } catch (err) {
    console.error("[activity-log]", err);
  }
}

export function parseProfileFromSession(session: Session | null) {
  try {
    const raw = (session?.user as { profile?: string } | null)?.profile;
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function parseOrganizationEntries(raw: unknown) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      try {
        const value = typeof item === "string" ? JSON.parse(item) : item;
        return {
          hcode: typeof value?.hcode === "string" ? value.hcode.trim() : "",
        };
      } catch {
        return { hcode: "" };
      }
    })
    .filter((item) => item.hcode);
}

export function sessionHasExportAccess(profile: unknown) {
  if (!profile || typeof profile !== "object") return false;

  const record = profile as {
    hcode?: unknown;
    organizations?: unknown;
    organization?: unknown;
  };

  if (typeof record.hcode === "string" && record.hcode.trim() === "00051") {
    return true;
  }

  const organizations = Array.isArray(record.organizations)
    ? record.organizations
    : Array.isArray(record.organization)
      ? record.organization
      : [];

  return parseOrganizationEntries(organizations).some((org) => org.hcode === "00051");
}
