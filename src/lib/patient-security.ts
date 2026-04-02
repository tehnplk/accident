import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const PATIENT_API_TOKEN_SCOPE = "patient-api";
const PATIENT_API_TOKEN_TTL_SECONDS = 60 * 60 * 12;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function signJwtPart(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest();
}

type PatientApiJwtPayload = {
  scope: string;
  exp: number;
};

export function getPatientAesSecret() {
  return getRequiredEnv("PATIENT_AES_SECRET");
}

export function getPatientApiJwtSecret() {
  return getRequiredEnv("PATIENT_API_JWT_SECRET");
}

export function createPatientApiToken() {
  const secret = getPatientApiJwtSecret();
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      scope: PATIENT_API_TOKEN_SCOPE,
      exp: Math.floor(Date.now() / 1000) + PATIENT_API_TOKEN_TTL_SECONDS,
    } satisfies PatientApiJwtPayload),
  );
  const message = `${header}.${payload}`;
  const signature = base64UrlEncode(signJwtPart(message, secret));
  return `${message}.${signature}`;
}

export function verifyPatientApiToken(token: string) {
  try {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) return false;

    const secret = getPatientApiJwtSecret();
    const expected = signJwtPart(`${header}.${payload}`, secret);
    const actual = Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64");

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return false;
    }

    const decodedPayload = JSON.parse(base64UrlDecode(payload)) as PatientApiJwtPayload;
    if (decodedPayload.scope !== PATIENT_API_TOKEN_SCOPE) return false;
    if (!Number.isFinite(decodedPayload.exp) || decodedPayload.exp <= Math.floor(Date.now() / 1000)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function readPatientApiToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  const url = new URL(request.url);
  return url.searchParams.get("token")?.trim() ?? "";
}

export function patientApiAuthorized(request: Request) {
  const token = readPatientApiToken(request);
  return token ? verifyPatientApiToken(token) : false;
}

export function patientEncryptedValueSql(valueParamIndex: number, secretParamIndex: number) {
  return `CASE
    WHEN NULLIF($${valueParamIndex}, '') IS NULL THEN NULL
    ELSE 'enc:' || encode(
      pgp_sym_encrypt($${valueParamIndex}, $${secretParamIndex}, 'cipher-algo=aes256'),
      'base64'
    )
  END`;
}

export function patientDecryptedColumnSql(
  column: "patient_name" | "cid" | "hn",
  secretParamIndex: number,
  tableAlias = "p",
) {
  return `CASE
    WHEN ${tableAlias}.${column} IS NULL OR ${tableAlias}.${column} = '' THEN NULL
    WHEN ${tableAlias}.${column} LIKE 'enc:%' THEN pgp_sym_decrypt(
      decode(substring(${tableAlias}.${column} FROM 5), 'base64'),
      $${secretParamIndex},
      'cipher-algo=aes256'
    )::text
    ELSE ${tableAlias}.${column}
  END`;
}
