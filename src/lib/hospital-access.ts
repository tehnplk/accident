import "server-only";

import { dbQuery } from "@/lib/db";

type OrganizationEntry = {
  hcode?: unknown;
  hname_th?: unknown;
  position?: unknown;
  affiliation?: unknown;
};

function normalizeCode(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseOrganizationEntries(raw: unknown): OrganizationEntry[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      try {
        return typeof item === "string" ? JSON.parse(item) : item;
      } catch {
        return null;
      }
    })
    .filter((item): item is OrganizationEntry => Boolean(item));
}

export function extractProfileOrganizationHcodes(profile: unknown) {
  if (!profile || typeof profile !== "object") return [];

  const record = profile as {
    hcode?: unknown;
    organizations?: unknown;
    organization?: unknown;
  };

  const directHcode = normalizeCode(record.hcode);
  const rawOrganizations = Array.isArray(record.organizations)
    ? record.organizations
    : Array.isArray(record.organization)
      ? record.organization
      : [];

  const organizationHcodes = parseOrganizationEntries(rawOrganizations)
    .map((entry) => normalizeCode(entry.hcode))
    .filter(Boolean);

  return Array.from(new Set([directHcode, ...organizationHcodes].filter(Boolean)));
}

export async function loadActiveHoscodes() {
  const result = await dbQuery<{ hoscode: string }>(
    `SELECT hoscode
     FROM public.hos
     WHERE is_active = true AND hoscode IS NOT NULL AND hoscode <> ''`,
  );

  return new Set(result.rows.map((row) => normalizeCode(row.hoscode)).filter(Boolean));
}

export async function profileHasActiveHoscode(profile: unknown) {
  const profileHcodes = extractProfileOrganizationHcodes(profile);
  if (profileHcodes.length === 0) return false;

  const activeHoscodes = await loadActiveHoscodes();
  return profileHcodes.some((code) => activeHoscodes.has(code));
}
