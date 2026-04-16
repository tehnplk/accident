import { NextRequest, NextResponse } from "next/server";
import { dbTransaction } from "@/lib/db";
import { patientApiAuthorized } from "@/lib/patient-security";

export const runtime = "nodejs";

type DbQueryBody = {
  sql?: unknown;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSql(sql: string) {
  return sql.replace(/;\s*$/, "").trim();
}

function splitQualifiedName(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(".");
  if (parts.length < 1 || parts.length > 2) return null;

  const normalized = parts.map((part) => {
    const value = part.trim();
    const unquoted =
      value.startsWith('"') && value.endsWith('"') && value.length >= 2 ? value.slice(1, -1) : value;

    return /^[A-Za-z_][A-Za-z0-9_$]*$/.test(unquoted) ? unquoted : null;
  });

  if (normalized.some((part) => !part)) return null;

  return normalized.length === 1
    ? { schema: "public", table: normalized[0] as string }
    : { schema: normalized[0] as string, table: normalized[1] as string };
}

function isAllowedSql(sql: string) {
  if (!sql) return false;
  if (sql.includes(";")) return false;
  if (!/^(select|show|desc)\b/i.test(sql)) return false;

  return !/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|vacuum|analyze|refresh)\b/i.test(
    sql,
  );
}

function parseDescribeTarget(sql: string) {
  const match = sql.match(/^desc(?:ribe)?\s+(.+)$/i);
  if (!match) return null;
  return splitQualifiedName(match[1] ?? "");
}

function getSqlExecutionPlan(sql: string) {
  if (/^select\b/i.test(sql)) {
    return { kind: "raw" as const, sql, values: [] as unknown[] };
  }

  if (/^show\b/i.test(sql)) {
    return { kind: "raw" as const, sql, values: [] as unknown[] };
  }

  const descTarget = parseDescribeTarget(sql);
  if (descTarget) {
    return {
      kind: "raw" as const,
      sql: `SELECT
              column_name AS Field,
              data_type AS Type,
              CASE WHEN is_nullable = 'YES' THEN 'YES' ELSE 'NO' END AS Null,
              column_default AS Default
            FROM information_schema.columns
            WHERE table_schema = $1
              AND table_name = $2
            ORDER BY ordinal_position`,
      values: [descTarget.schema, descTarget.table],
    };
  }

  return null;
}

function getSchemaOverviewPlan() {
  return {
    sql: `SELECT
            cols.table_name AS table_name,
            cols.column_name AS field,
            cols.data_type AS type,
            COALESCE(cols.character_maximum_length::text, cols.numeric_precision::text, '') AS length,
            CASE WHEN pk.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END AS pk
          FROM information_schema.columns cols
          LEFT JOIN (
            SELECT
              kcu.table_schema,
              kcu.table_name,
              kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON kcu.constraint_name = tc.constraint_name
             AND kcu.table_schema = tc.table_schema
             AND kcu.table_name = tc.table_name
            WHERE tc.constraint_type = 'PRIMARY KEY'
          ) pk
            ON pk.table_schema = cols.table_schema
           AND pk.table_name = cols.table_name
           AND pk.column_name = cols.column_name
          WHERE cols.table_schema = 'public'
          ORDER BY cols.table_name, cols.ordinal_position`,
    values: [] as unknown[],
  };
}

function serializeCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();

  const text =
    typeof value === "object"
      ? JSON.stringify(value)
      : typeof value === "bigint"
        ? value.toString()
        : String(value);

  return text.replace(/\r?\n/g, " ").replace(/\|/g, "/");
}

function rowsToPipeText(headers: string[], rows: Record<string, unknown>[]) {
  if (headers.length === 0) return "";

  const lines = [headers.map(serializeCell).join("|")];

  for (const row of rows) {
    lines.push(headers.map((header) => serializeCell(row[header])).join("|"));
  }

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    if (!patientApiAuthorized(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.text();
    const body = rawBody.trim().length === 0 ? {} : (JSON.parse(rawBody) as DbQueryBody);
    const rawSql = normalizeText(body.sql);
    const sql = normalizeSql(rawSql);

    const executionPlan = !sql
      ? getSchemaOverviewPlan()
      : !isAllowedSql(sql)
        ? null
        : getSqlExecutionPlan(sql);

    if (!sql && !executionPlan) {
      return NextResponse.json({ message: "Failed to build schema overview query" }, { status: 500 });
    }
    if (sql && !isAllowedSql(sql)) {
      return NextResponse.json(
        { message: "Only a single SELECT, DESC, or SHOW statement is allowed" },
        { status: 400 },
      );
    }
    if (sql && !executionPlan) {
      return NextResponse.json({ message: "Invalid DESC target" }, { status: 400 });
    }

    if (!executionPlan) {
      return NextResponse.json({ message: "Invalid query plan" }, { status: 400 });
    }

    const result = await dbTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = 30000");
      await client.query("SET LOCAL idle_in_transaction_session_timeout = 30000");
      await client.query("SET LOCAL TRANSACTION READ ONLY");
      return client.query<Record<string, unknown>>(executionPlan.sql, executionPlan.values);
    });

    const headers = result.fields.map((field) => field.name);

    return new NextResponse(rowsToPipeText(headers, result.rows), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to execute query",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
