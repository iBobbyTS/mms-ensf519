import assert from "node:assert/strict";
import test from "node:test";

process.env.TZ = "UTC";

const {
    nowSqlDate,
    nowSqlDateTime,
    toSqlDate,
    toSqlDateTime,
} = await import("./server/db.ts");

test("toSqlDateTime preserves naive local datetime strings", () => {
    assert.equal(toSqlDateTime("2026-04-11 14:23:45"), "2026-04-11 14:23:45");
    assert.equal(toSqlDateTime("2026-04-11T14:23"), "2026-04-11 14:23:00");
});

test("toSqlDateTime converts UTC ISO strings into business wall-clock time", () => {
    assert.equal(
        toSqlDateTime("2026-04-11T20:00:00.000Z"),
        "2026-04-11 14:00:00",
    );
    assert.equal(
        toSqlDateTime("2026-12-15T21:00:00.000Z"),
        "2026-12-15 14:00:00",
    );
});

test("toSqlDate converts UTC ISO strings using business calendar date", () => {
    assert.equal(toSqlDate("2026-04-11T01:30:00.000Z"), "2026-04-10");
});

test("toSqlDate preserves SQL date strings", () => {
    assert.equal(toSqlDate("2026-12-31"), "2026-12-31");
    assert.equal(toSqlDate("2026-12-31 00:00:00"), "2026-12-31");
});

test("nowSqlDateTime and nowSqlDate return timezone-less business SQL strings", () => {
    assert.match(nowSqlDate(), /^\d{4}-\d{2}-\d{2}$/);
    assert.match(nowSqlDateTime(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.equal(nowSqlDate(new Date("2026-01-01T06:30:00.000Z")), "2025-12-31");
    assert.equal(
        nowSqlDateTime(new Date("2026-06-28T20:00:00.000Z")),
        "2026-06-28 14:00:00",
    );
});

test("toSqlDateTime returns null for invalid values", () => {
    assert.equal(toSqlDateTime("not-a-date"), null);
});
