import crypto from "node:crypto";

const SUPABASE_JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ??
  "super-secret-jwt-token-with-at-least-32-characters-long";

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

export function createLocalSupabaseToken(role: "service_role" | "anon" = "service_role") {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload = {
    aud: "authenticated",
    exp: now + 60 * 60 * 24,
    iat: now,
    iss: "supabase",
    role,
    sub: role,
  };

  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(payload),
  )}`;
  const signature = crypto
    .createHmac("sha256", SUPABASE_JWT_SECRET)
    .update(unsignedToken)
    .digest("base64url");

  return `${unsignedToken}.${signature}`;
}

export const localSupabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
