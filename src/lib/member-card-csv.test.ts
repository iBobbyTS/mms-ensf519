import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMemberCardsCsv, MemberCardCsvError, parseMemberCardInput } from "./server/member-card-csv.ts";
import { createMemberCardDownloadHandler } from "./server/member-card-download-handler.ts";

test("member card parser expands, sorts, deduplicates and pads", () => {
    assert.deepEqual(parseMemberCardInput("1-3, 0002, 5"), ["SCSC0001", "SCSC0002", "SCSC0003", "SCSC0005"]);
});

test("member card parser rejects malformed and reverse ranges", () => {
    assert.throws(() => parseMemberCardInput("3-1"), MemberCardCsvError);
    assert.throws(() => parseMemberCardInput("1,,2"), MemberCardCsvError);
    assert.throws(() => parseMemberCardInput("abc"), MemberCardCsvError);
});

test("member card CSV uses name fallback and escapes cells", async () => {
    const rows = [
        { clientCode: "SCSC0001", chineseName: " 王,五 ", englishName: "Ignored", firstName: null, lastName: null },
        { clientCode: "SCSC0002", chineseName: "", englishName: "Alice \"A\"", firstName: null, lastName: null },
        { clientCode: "SCSC0003", chineseName: "", englishName: "", firstName: "Jane", lastName: "Doe" },
    ];
    const result = await buildMemberCardsCsv({} as never, "3,1-2", async () => rows);
    assert.equal(result.csv, 'name,id\n"王,五",SCSC0001\n"Alice ""A""",SCSC0002\nJane Doe,SCSC0003\n');
    assert.equal(result.csv.startsWith("\uFEFF"), false);
    assert.equal(result.csv.includes("\r"), false);
});

test("member card CSV blocks the whole result and reports every missing code", async () => {
    const result = await buildMemberCardsCsv({} as never, "1-3", async () => [{ clientCode: "SCSC0002", chineseName: "Two", englishName: null, firstName: null, lastName: null }]);
    assert.deepEqual(result, { csv: "", missing: ["SCSC0001", "SCSC0003"], disabled: [], expired: [] });
});

test("member card CSV reports disabled and expired members by category", async () => {
    const result = await buildMemberCardsCsv({} as never, "1-3", async () => [
        { clientCode: "SCSC0001", chineseName: "One", englishName: null, firstName: null, lastName: null, status: "disabled", membershipType: "General", lastMembershipYear: 2026 },
        { clientCode: "SCSC0002", chineseName: "Two", englishName: null, firstName: null, lastName: null, status: "active", membershipType: "General", lastMembershipYear: 2024 },
        { clientCode: "SCSC0003", chineseName: "Three", englishName: null, firstName: null, lastName: null, status: "active", membershipType: "Lifetime", lastMembershipYear: null },
    ]);
    assert.deepEqual(result, { csv: "", missing: [], disabled: ["SCSC0001"], expired: ["SCSC0002"] });
});

test("member card DB lookup stays below the D1 100-bind limit", async () => {
    const chunks: number[] = [];
    await buildMemberCardsCsv({} as never, "1-100", async (_db, codes) => { chunks.push(codes.length); return []; });
    assert.deepEqual(chunks, [99, 1]);
});

test("member card route returns CSV and missing responses without a partial attachment", async () => {
    const request = new Request("http://localhost", { method: "POST", body: JSON.stringify({ input: "1" }) });
    const success = createMemberCardDownloadHandler({ getDb: () => ({}) as never, buildCsv: async () => ({ csv: "name,id\nAlice,SCSC0001\n", missing: [], disabled: [], expired: [] }) });
    const response = await success({ request } as never);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-disposition"), 'attachment; filename="member-cards.csv"');
    assert.equal(await response.text(), "name,id\nAlice,SCSC0001\n");

    const missing = createMemberCardDownloadHandler({ getDb: () => ({}) as never, buildCsv: async () => ({ csv: "", missing: ["SCSC0009"], disabled: [], expired: [] }) });
    const missingResponse = await missing({ request: new Request("http://localhost", { method: "POST", body: JSON.stringify({ input: "9" }) }) } as never);
    assert.equal(missingResponse.status, 404);
    assert.deepEqual(await missingResponse.json(), { error: "member_status", missing: ["SCSC0009"], disabled: [], expired: [] });
    assert.equal(missingResponse.headers.has("content-disposition"), false);
});
