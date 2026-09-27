import assert from "node:assert/strict";
import test from "node:test";

process.env.TZ = "UTC";

const {
    addBusinessDateDays,
    businessClockMs,
    businessDateDaysBefore,
    currentBusinessYear,
    formatBusinessDate,
    formatBusinessDateTime,
    formatLocalDate,
    formatLocalDateTime,
    parseBusinessSqlDateTime,
} = await import("./local-date.ts");

test("business date formatting uses Edmonton calendar parts in a UTC runtime", () => {
    assert.equal(
        formatBusinessDate(new Date("2026-04-11T01:30:00.000Z")),
        "2026-04-10",
    );
    assert.equal(
        formatBusinessDate(new Date("2026-01-01T06:30:00.000Z")),
        "2025-12-31",
    );
});

test("business datetime formatting handles Edmonton daylight and standard time", () => {
    assert.equal(
        formatBusinessDateTime(new Date("2026-06-28T20:00:00.000Z")),
        "2026-06-28 14:00:00",
    );
    assert.equal(
        formatBusinessDateTime(new Date("2026-12-15T21:00:00.000Z")),
        "2026-12-15 14:00:00",
    );
});

test("business helpers expose current year, date math, and wall-clock parsing", () => {
    assert.equal(currentBusinessYear(new Date("2026-01-01T06:30:00.000Z")), 2025);
    assert.equal(addBusinessDateDays("2026-03-01", -1), "2026-02-28");
    assert.equal(businessDateDaysBefore(new Date("2026-03-10T06:00:00.000Z"), 30), "2026-02-08");
    assert.equal(
        parseBusinessSqlDateTime("2026-04-11 14:00:00"),
        Date.UTC(2026, 3, 11, 14, 0, 0),
    );
    assert.equal(parseBusinessSqlDateTime("2026-02-30 14:00:00"), null);
    assert.equal(
        businessClockMs(new Date("2026-04-11T20:00:00.000Z")),
        Date.UTC(2026, 3, 11, 14, 0, 0),
    );
});

test("legacy local-date exports are business-time aliases", () => {
    assert.equal(
        formatLocalDate(new Date("2026-04-11T01:30:00.000Z")),
        "2026-04-10",
    );
    assert.equal(
        formatLocalDateTime(new Date("2026-04-11T20:00:00.000Z")),
        "2026-04-11 14:00:00",
    );
});
