import { sql, type SQL } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";

import { schema } from "./db-schema.ts";
import { assertRawSqlReason, type RawSqlReasonKey } from "./raw-sql-exceptions.ts";
import {
    formatBusinessDate,
    formatBusinessDateTime,
    todayBusinessDate,
} from "../local-date.ts";

type BindValue = string | number | null;
type BatchStatement = { sql: string; params?: BindValue[] };
type RawSqlOptions = {
    reasonKey: RawSqlReasonKey;
    sql: string;
    params?: BindValue[];
};
type RawBatchOptions = {
    reasonKey: RawSqlReasonKey;
    statements: BatchStatement[];
};

export type AppDb = DrizzleD1Database<typeof schema> & { $client: D1Database };

function normalizeNaiveSqlDateTime(value: string): string | null {
    const match = value
        .trim()
        .match(
            /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/,
        );
    if (!match) return null;
    const [, date, hour, minute, second] = match;
    return `${date} ${hour}:${minute}:${second ?? "00"}`;
}

export function getD1Db(platform?: App.Platform): D1Database {
    const db = platform?.env.DB;
    if (!db) {
        throw new Error("数据库连接失败");
    }
    return db;
}

export function getDb(platform?: App.Platform): AppDb {
    return drizzle(getD1Db(platform), { schema }) as AppDb;
}

function splitSqlPlaceholders(sqlText: string): string[] {
    const parts = [""];
    let quote: "'" | "\"" | "`" | null = null;
    let inLineComment = false;
    let inBlockComment = false;

    const append = (value: string) => {
        parts[parts.length - 1] += value;
    };

    for (let index = 0; index < sqlText.length; index += 1) {
        const char = sqlText[index];
        const next = sqlText[index + 1];

        if (inLineComment) {
            append(char);
            if (char === "\n") inLineComment = false;
            continue;
        }

        if (inBlockComment) {
            append(char);
            if (char === "*" && next === "/") {
                append(next);
                index += 1;
                inBlockComment = false;
            }
            continue;
        }

        if (quote) {
            append(char);
            if (char === quote) {
                if (next === quote) {
                    append(next);
                    index += 1;
                } else {
                    quote = null;
                }
            }
            continue;
        }

        if (char === "-" && next === "-") {
            append(char);
            append(next);
            index += 1;
            inLineComment = true;
            continue;
        }

        if (char === "/" && next === "*") {
            append(char);
            append(next);
            index += 1;
            inBlockComment = true;
            continue;
        }

        if (char === "'" || char === "\"" || char === "`") {
            quote = char;
            append(char);
            continue;
        }

        if (char === "?") {
            parts.push("");
            continue;
        }

        append(char);
    }

    return parts;
}

function bindSql(sqlText: string, params: BindValue[] = []): SQL {
    const parts = splitSqlPlaceholders(sqlText);
    if (parts.length - 1 !== params.length) {
        throw new Error("SQL 参数数量不匹配");
    }

    const chunks: SQL[] = [sql.raw(parts[0])];
    for (let index = 0; index < params.length; index += 1) {
        chunks.push(sql`${params[index]}`);
        chunks.push(sql.raw(parts[index + 1]));
    }
    return sql.join(chunks);
}

export const dbTestUtils = {
    splitSqlPlaceholders,
};

export async function rawAll<T>(
    db: AppDb,
    options: RawSqlOptions,
): Promise<T[]> {
    assertRawSqlReason(options.reasonKey);
    return db.all<T>(bindSql(options.sql, options.params ?? []));
}

export async function rawFirst<T>(
    db: AppDb,
    options: RawSqlOptions,
): Promise<T | null> {
    assertRawSqlReason(options.reasonKey);
    const row = await db.get<T>(bindSql(options.sql, options.params ?? []));
    return row ?? null;
}

export async function rawRun(
    db: AppDb,
    options: RawSqlOptions,
): Promise<D1Result> {
    assertRawSqlReason(options.reasonKey);
    return db.run(bindSql(options.sql, options.params ?? []));
}

export async function rawBatch(
    db: AppDb,
    options: RawBatchOptions,
): Promise<D1Result[]> {
    assertRawSqlReason(options.reasonKey);
    const { statements } = options;
    if (statements.length === 0) return [];
    return db.$client.batch(
        statements.map((statement) =>
            db.$client.prepare(statement.sql).bind(...(statement.params ?? [])),
        ),
    );
}

export function getLastInsertId(result: D1Result): number {
    return Number(result.meta.last_row_id ?? 0);
}

export function toSqlDate(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const naiveDateTime = normalizeNaiveSqlDateTime(trimmed);
    if (naiveDateTime) return naiveDateTime.slice(0, 10);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return formatBusinessDate(date);
}

export function toSqlDateTime(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    const naiveDateTime = normalizeNaiveSqlDateTime(trimmed);
    if (naiveDateTime) return naiveDateTime;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed} 00:00:00`;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return formatBusinessDateTime(date);
}

export function nowSqlDate(now = new Date()): string {
    return todayBusinessDate(now);
}

export function nowSqlDateTime(now = new Date()): string {
    return formatBusinessDateTime(now);
}
