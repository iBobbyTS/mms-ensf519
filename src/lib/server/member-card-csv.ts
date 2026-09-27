import { and, eq, inArray, sql } from "drizzle-orm";
import { schema } from "./db-schema.ts";
import type { AppDb } from "./db.ts";
import { currentYear, getMembershipState } from "../membership-year-status.ts";

const MAX_ITEMS = 10_000;
const CODE_PREFIX = "SCSC";

export class MemberCardCsvError extends Error {
    code: "invalid" | "missing" | "name";
    details: string[];

    constructor(code: "invalid" | "missing" | "name", message: string, details: string[] = []) {
        super(message);
        this.code = code;
        this.details = details;
    }
}

export function parseMemberCardInput(input: string): string[] {
    if (typeof input !== "string" || !input.trim()) throw new MemberCardCsvError("invalid", "Input is required.");
    const values = new Set<number>();
    for (const rawToken of input.split(",")) {
        const token = rawToken.trim();
        if (!token) throw new MemberCardCsvError("invalid", "Invalid member number format.");
        const range = token.match(/^(\d+)(?:-(\d+))?$/);
        if (!range) throw new MemberCardCsvError("invalid", "Invalid member number format.");
        const start = Number(range[1]);
        const end = range[2] === undefined ? start : Number(range[2]);
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < 1 || end < start) {
            throw new MemberCardCsvError("invalid", "Invalid member number range.");
        }
        if (end - start + 1 > MAX_ITEMS || values.size + end - start + 1 > MAX_ITEMS) {
            throw new MemberCardCsvError("invalid", "Too many member numbers.");
        }
        for (let value = start; value <= end; value += 1) values.add(value);
    }
    return [...values].sort((a, b) => a - b).map((value) => `${CODE_PREFIX}${String(value).padStart(4, "0")}`);
}

function csvCell(value: string): string {
    const quote = String.fromCharCode(34);
    const needsEscaping = value.includes(",") || value.includes("\n") || value.includes("\r") || value.includes(quote);
    return needsEscaping ? `${quote}${value.replaceAll(quote, `${quote}${quote}`)}${quote}` : value;
}

export type MemberCardRow = {
    clientCode: string;
    chineseName: string | null;
    englishName: string | null;
    firstName: string | null;
    lastName: string | null;
    clientType?: string | null;
    membershipType?: string | null;
    status?: string | null;
    lastMembershipYear?: number | null;
};

async function loadMemberRows(db: AppDb, codes: string[]): Promise<MemberCardRow[]> {
    const rows = await db.select({
        id: schema.clients.id,
        clientCode: schema.clients.clientCode,
        chineseName: schema.clients.chineseName,
        englishName: schema.clients.englishName,
        firstName: schema.clients.firstName,
        lastName: schema.clients.lastName,
        clientType: schema.clients.clientType,
        membershipType: schema.clients.membershipType,
        status: schema.clients.status,
    })
        .from(schema.clients)
        .where(and(eq(schema.clients.clientType, "Member"), inArray(schema.clients.clientCode, codes)));
    const ids = rows.map((row) => row.id);
    const paymentYears = ids.length
        ? await db.select({
            payerClientId: schema.receipts.payerClientId,
            lastMembershipYear: sql<number | null>`MAX(${schema.receipts.membershipYear})`,
        }).from(schema.receipts).where(and(
            inArray(schema.receipts.payerClientId, ids),
            eq(schema.receipts.status, "active"),
            eq(schema.receipts.paymentType, "Membership Fee"),
        )).groupBy(schema.receipts.payerClientId)
        : [];
    const yearsById = new Map(paymentYears.map((row) => [row.payerClientId, row.lastMembershipYear]));
    return rows.map(({ id, ...row }) => ({ ...row, lastMembershipYear: yearsById.get(id) ?? null }));
}

export async function buildMemberCardsCsv(db: AppDb, input: string, loadRows: (db: AppDb, codes: string[]) => Promise<MemberCardRow[]> = loadMemberRows): Promise<{ csv: string; missing: string[]; disabled: string[]; expired: string[] }> {
    const codes = parseMemberCardInput(input);
    const rows: MemberCardRow[] = [];
    for (let offset = 0; offset < codes.length; offset += 99) {
        rows.push(...await loadRows(db, codes.slice(offset, offset + 99)));
    }
    const byCode = new Map(rows.map((row) => [row.clientCode, row]));
    const missing = codes.filter((code) => !byCode.has(code));
    const disabled = rows.filter((row) => row.status === "disabled").map((row) => row.clientCode).sort();
    const expired = rows.filter((row) => row.status !== "disabled" && row.membershipType && getMembershipState({
        clientType: row.clientType ?? "Member",
        membershipType: row.membershipType,
        lastMembershipYear: row.lastMembershipYear ?? null,
        currentYear: currentYear(),
    }) === "expired").map((row) => row.clientCode).sort();
    if (missing.length || disabled.length || expired.length) return { csv: "", missing, disabled, expired };
    const output = ["name,id"];
    for (const code of codes) {
        const row = byCode.get(code)!;
        const name = row.chineseName?.trim() || row.englishName?.trim() || [row.firstName, row.lastName].filter((value) => value?.trim()).join(" ").trim();
        if (!name) throw new MemberCardCsvError("name", "Member name is unavailable.", [code]);
        output.push(`${csvCell(name)},${csvCell(code)}`);
    }
    return { csv: `${output.join("\n")}\n`, missing: [], disabled: [], expired: [] };
}
