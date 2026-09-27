import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { RAW_SQL_EXCEPTIONS } from "./server/raw-sql-exceptions.ts";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const scannedRoots = ["src", "scripts"];
const ignoredPathPatterns = [
    /^src\/lib\/paraglide\//,
    /^src\/paraglide\//,
    /^src\/lib\/server\/db\.ts$/,
    /^src\/lib\/server\/db-schema\.ts$/,
    /^src\/lib\/raw-sql-policy\.test\.ts$/,
    /\.test\.[cm]?[jt]s$/,
];
const allowedSqlArtifacts = new Set([
    "schema.sql",
    "drizzle/0000_baseline.sql",
    "migrations/0001_baseline.sql",
]);
const rawSqlFileAllowlist = new Set<string>(
    Object.values(RAW_SQL_EXCEPTIONS).flatMap((entry) => entry.files),
);
const sqlPattern =
    /\bSELECT\b[\s\S]{0,240}\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+[a-z_`"]+\s+SET\b|\bDELETE\s+FROM\b|\bON\s+CONFLICT\b|\bCREATE\s+(?:TABLE|INDEX)\b|\bDROP\s+TABLE\b|\bPRAGMA\b|\bCHECK\s+TABLE\b/i;
const preparePattern = /\.prepare\(/;
const legacyHelperPattern = /\b(queryAll|queryFirst|executeBatch|execute)\s*\(/;
const rawHelperCallPattern = /\braw(All|First|Run|Batch)\s*(?:<[^>]+>)?\s*\(/g;
const localRawWrapperPattern =
    /\bfunction\s+\w*Raw(All|First|Run|Batch)\s*(?:<[^>]+>)?\s*\(|\bconst\s+\w*Raw(All|First|Run|Batch)\s*=/;
const stringLiteralPattern = /(["'`])(?:\\.|(?!\1)[\s\S])*?\1/g;

function listFiles(root: string): string[] {
    const absoluteRoot = path.join(repoRoot, root);
    const results: string[] = [];
    for (const entry of readdirSync(absoluteRoot)) {
        const absolutePath = path.join(absoluteRoot, entry);
        const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, "/");
        const info = statSync(absolutePath);
        if (info.isDirectory()) {
            results.push(...listFiles(relativePath));
        } else if (info.isFile()) {
            results.push(relativePath);
        }
    }
    return results;
}

function isIgnoredPath(filePath: string): boolean {
    return ignoredPathPatterns.some((pattern) => pattern.test(filePath));
}

function isPotentialDbSurface(filePath: string): boolean {
    if (isIgnoredPath(filePath)) return false;
    if (filePath.startsWith("src/lib/server/")) return true;
    if (filePath === "src/hooks.server.ts") return true;
    if (/^src\/routes\/(?:.*\/)?\+(?:page\.server|server)\.ts$/.test(filePath)) return true;
    if (filePath.startsWith("scripts/")) {
        return filePath.endsWith(".ts") || filePath.endsWith(".sh");
    }
    return false;
}

function readRepoFile(filePath: string): string {
    return readFileSync(path.join(repoRoot, filePath), "utf8");
}

function hasRawSqlSyntax(source: string): boolean {
    if (preparePattern.test(source)) return true;
    return Array.from(source.matchAll(stringLiteralPattern)).some((match) =>
        sqlPattern.test(match[0]),
    );
}

test("raw SQL use is registered or generated", () => {
    const scannedFiles = scannedRoots.flatMap(listFiles).filter(isPotentialDbSurface);
    const offenders = scannedFiles.filter((filePath) => {
        if (allowedSqlArtifacts.has(filePath)) return false;
        if (rawSqlFileAllowlist.has(filePath)) return false;
        return hasRawSqlSyntax(readRepoFile(filePath));
    });

    assert.deepEqual(offenders, []);
});

test("legacy raw DB helpers do not reappear", () => {
    const scannedFiles = scannedRoots.flatMap(listFiles).filter(isPotentialDbSurface);
    const offenders = scannedFiles.filter((filePath) => legacyHelperPattern.test(readRepoFile(filePath)));

    assert.deepEqual(offenders, []);
});

test("raw helper calls carry an allowlisted reason key", () => {
    const scannedFiles = scannedRoots.flatMap(listFiles).filter(isPotentialDbSurface);
    const offenders: string[] = [];

    for (const filePath of scannedFiles) {
        if (filePath === "src/lib/server/db.ts") continue;
        const source = readRepoFile(filePath);
        const matches = source.matchAll(rawHelperCallPattern);
        for (const match of matches) {
            const rest = source.slice(match.index ?? 0, (match.index ?? 0) + 2000);
            const reasonMatch = rest.match(/reasonKey:\s*["']([a-z0-9.-]+)["']/);
            if (!reasonMatch) {
                offenders.push(`${filePath}:${match[0]}`);
                continue;
            }

            const reasonKey = reasonMatch[1] as keyof typeof RAW_SQL_EXCEPTIONS;
            const exception = RAW_SQL_EXCEPTIONS[reasonKey];
            if (!exception || !(exception.files as readonly string[]).includes(filePath)) {
                offenders.push(`${filePath}:${match[0]}:${reasonMatch[1]}`);
            }
        }
    }

    assert.deepEqual(offenders, []);
});

test("FSII temporary survey writes use the dedicated lifecycle guard reason", () => {
    const source = readRepoFile("src/lib/server/fsii-survey-responses.ts");
    const exception = RAW_SQL_EXCEPTIONS["fsii-survey-responses.active-temporary-write"];
    assert.deepEqual(exception.files, ["src/lib/server/fsii-survey-responses.ts"]);
    assert.match(source, /reasonKey: "fsii-survey-responses\.active-temporary-write"/);
    assert.match(source, /converted_client_id IS NULL AND converted_at IS NULL/);
});

test("local raw helper wrappers do not hide reason keys", () => {
    const scannedFiles = scannedRoots.flatMap(listFiles).filter(isPotentialDbSurface);
    const offenders = scannedFiles.filter((filePath) => {
        if (filePath === "src/lib/server/db.ts") return false;
        return localRawWrapperPattern.test(readRepoFile(filePath));
    });

    assert.deepEqual(offenders, []);
});

test("domain rawRun is limited to guarded activity creation and check-in", () => {
    const source = readRepoFile("src/lib/server/domain.ts");
    const activityCreate = source.match(
        /export async function createActivity[\s\S]*?export type ActivityConditionalUpdateInput/,
    );
    assert.ok(activityCreate, "missing createActivity block");
    assert.match(activityCreate[0], /reasonKey: "activity\.create-active-project"/);
    const activityCheckIn = source.match(
        /export async function checkInActivityAttendance[\s\S]*?export async function undoActivityAttendance/,
    );
    assert.ok(activityCheckIn, "missing checkInActivityAttendance block");
    assert.match(activityCheckIn[0], /reasonKey: "activity\.check-in-registration-gate"/);
    assert.doesNotMatch(
        source.replace(activityCreate[0], "").replace(activityCheckIn[0], ""),
        /\brawRun\s*\(/,
    );
});

test("static receipt and activity queries stay on Drizzle", () => {
    const domain = readRepoFile("src/lib/server/domain.ts");

    assert.doesNotMatch(domain, /domain\.complex-receipt-and-activity-reports/);

    for (const [name, nextName] of [
        ["listReceipts", "getReceiptDetail"],
        ["getReceiptDetail", "activityRegistrationCounts"],
        ["listActivities", "listActivityOptions"],
        ["getActivityDetail", "mapActivityParticipantRow"],
    ] as const) {
        const block = domain.match(
            new RegExp(`export async function ${name}[\\s\\S]*?${nextName}`),
        );
        assert.ok(block, `missing ${name} block`);
        assert.doesNotMatch(block[0], /\braw(All|First)\s*</);
        assert.match(block[0], /\.leftJoin\(/);
    }
});
