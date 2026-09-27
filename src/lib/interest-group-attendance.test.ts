import assert from "node:assert/strict";
import test from "node:test";

import {
    resolveInterestGroupAttendanceSelection,
} from "./interest-group-attendance.ts";

test("resolveInterestGroupAttendanceSelection defaults to first group and today", () => {
    const result = resolveInterestGroupAttendanceSelection({
        interestGroups: [{ id: 3 }, { id: 8 }],
        requestedInterestGroupId: null,
    });

    assert.deepEqual(result, { interestGroupId: 3 });
});

test("resolveInterestGroupAttendanceSelection keeps valid url state unchanged", () => {
    const result = resolveInterestGroupAttendanceSelection({
        interestGroups: [{ id: 3 }, { id: 8 }],
        requestedInterestGroupId: 8,
    });

    assert.deepEqual(result, { interestGroupId: 8 });
});

test("resolveInterestGroupAttendanceSelection normalizes invalid ids", () => {
    const result = resolveInterestGroupAttendanceSelection({
        interestGroups: [{ id: 3 }, { id: 8 }],
        requestedInterestGroupId: 99,
    });

    assert.deepEqual(result, { interestGroupId: 3 });
});
