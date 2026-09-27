import assert from "node:assert/strict";
import test from "node:test";

import {
    getAttendanceFeedbackTone,
    getAttendanceUndoRemainingMs,
    isAttendanceSuccessfulCheckResult,
    isAttendanceCheckOutConfirmationRequired,
    isAttendanceRegisterAgainConfirmationRequired,
    isAttendanceUndoAllowed,
    mergeAttendanceSearchParamDict,
    mergeAttendanceSearchOptions,
    resolveAttendanceSearchExactMatch,
    resolveAttendanceSubmissionOutcome,
    resolveContinuousScanResult,
    resolveOpenAttendanceDuplicateAction,
    shouldFailSubmittedAttendanceLookup,
    shouldAutoRegisterScannedMember,
} from "./member-attendance.ts";

test("attendance search formatting preserves temporary participant metadata", () => {
    assert.deepEqual(
        mergeAttendanceSearchParamDict(
            {
                clientCode: "TMP0001",
                param_dict: {
                    "Temporary ID": "TMP0001",
                    "Year of Birth": 1990,
                },
            },
            "Client Code",
        ),
        {
            "Client Code": "TMP0001",
            "Temporary ID": "TMP0001",
            "Year of Birth": 1990,
        },
    );
});

test("mergeAttendanceSearchOptions keeps both result sources visible when both are saturated", () => {
    assert.deepEqual(
        mergeAttendanceSearchOptions(
            ["member-1", "member-2", "member-3", "member-4"],
            ["temporary-1", "temporary-2", "temporary-3", "temporary-4"],
            4,
        ),
        ["member-1", "temporary-1", "member-2", "temporary-2"],
    );
});

test("mergeAttendanceSearchOptions fills unused capacity from the remaining source", () => {
    assert.deepEqual(
        mergeAttendanceSearchOptions(
            ["member-1"],
            ["temporary-1", "temporary-2", "temporary-3"],
            4,
        ),
        ["member-1", "temporary-1", "temporary-2", "temporary-3"],
    );
    assert.deepEqual(
        mergeAttendanceSearchOptions(["member-1", "member-2"], [], 2),
        ["member-1", "member-2"],
    );
});

test("resolveAttendanceSearchExactMatch rejects cross-source name ambiguity", () => {
    const member = { clientCode: "M0001", title: "Same Name" };
    const temporary = { clientCode: "TMP0001", title: "Same Name" };
    const memberUniqueResult = resolveAttendanceSearchExactMatch("Same Name", [
        {
            options: [member],
            exactMatch: member,
            exactMatchCount: 1,
        },
        {
            options: [temporary],
            exactMatch: null,
            exactMatchCount: 2,
        },
    ]);

    assert.equal(memberUniqueResult, null);
    assert.equal(
        shouldAutoRegisterScannedMember({
            shouldAutoRegisterAfterScan: true,
            memberSearchStatus: memberUniqueResult ? "valid" : "invalid",
            hasSelectedMember: Boolean(memberUniqueResult),
            isSubmitting: false,
        }),
        false,
    );
    assert.equal(
        resolveAttendanceSearchExactMatch("Same Name", [
            {
                options: [member],
                exactMatch: null,
                exactMatchCount: 2,
            },
            {
                options: [temporary],
                exactMatch: temporary,
                exactMatchCount: 1,
            },
        ]),
        null,
    );
});

test("resolveAttendanceSearchExactMatch keeps exact participant codes authoritative", () => {
    const member = { clientCode: "M0001", title: "Member" };
    const temporary = { clientCode: "TMP0001", title: "Temporary" };

    assert.equal(
        resolveAttendanceSearchExactMatch("tmp0001", [
            {
                options: [member],
                exactMatch: null,
                exactMatchCount: 2,
            },
            {
                options: [temporary],
                exactMatch: temporary,
                exactMatchCount: 1,
            },
        ]),
        temporary,
    );
});

test("attendance check result helpers classify grace and duplicate as warnings", () => {
    assert.equal(getAttendanceFeedbackTone("Success"), "success");
    assert.equal(getAttendanceFeedbackTone("Grace"), "warning");
    assert.equal(getAttendanceFeedbackTone("Duplicated"), "warning");
    assert.equal(getAttendanceFeedbackTone("Invalid"), "error");
    assert.equal(isAttendanceSuccessfulCheckResult("Success"), true);
    assert.equal(isAttendanceSuccessfulCheckResult("Grace"), true);
    assert.equal(isAttendanceSuccessfulCheckResult("Duplicated"), false);
    assert.equal(isAttendanceSuccessfulCheckResult("Invalid"), false);
});

test("resolveContinuousScanResult accepts a new non-empty scan", () => {
    assert.deepEqual(
        resolveContinuousScanResult({
            decodedText: " SCSC-1001 ",
            lastAcceptedScanText: "",
            shouldAutoRegisterAfterScan: false,
            memberSearchStatus: "empty",
            isSubmitting: false,
        }),
        { accepted: true, value: "SCSC-1001" },
    );
});

test("resolveContinuousScanResult rejects blank and repeated scans", () => {
    assert.deepEqual(
        resolveContinuousScanResult({
            decodedText: "   ",
            lastAcceptedScanText: "",
            shouldAutoRegisterAfterScan: false,
            memberSearchStatus: "empty",
            isSubmitting: false,
        }),
        { accepted: false, value: "" },
    );

    assert.deepEqual(
        resolveContinuousScanResult({
            decodedText: "SCSC-1001",
            lastAcceptedScanText: "SCSC-1001",
            shouldAutoRegisterAfterScan: false,
            memberSearchStatus: "empty",
            isSubmitting: false,
        }),
        { accepted: false, value: "SCSC-1001" },
    );
});

test("resolveContinuousScanResult rejects scans while another scan is being handled", () => {
    assert.equal(
        resolveContinuousScanResult({
            decodedText: "SCSC-1002",
            lastAcceptedScanText: "SCSC-1001",
            shouldAutoRegisterAfterScan: true,
            memberSearchStatus: "empty",
            isSubmitting: false,
        }).accepted,
        false,
    );

    assert.equal(
        resolveContinuousScanResult({
            decodedText: "SCSC-1002",
            lastAcceptedScanText: "SCSC-1001",
            shouldAutoRegisterAfterScan: false,
            memberSearchStatus: "loading",
            isSubmitting: false,
        }).accepted,
        false,
    );

    assert.equal(
        resolveContinuousScanResult({
            decodedText: "SCSC-1002",
            lastAcceptedScanText: "SCSC-1001",
            shouldAutoRegisterAfterScan: false,
            memberSearchStatus: "valid",
            isSubmitting: true,
        }).accepted,
        false,
    );
});

test("resolveContinuousScanResult accepts the same scan after repeat cooldown", () => {
    assert.equal(
        resolveContinuousScanResult({
            decodedText: "SCSC-1001",
            lastAcceptedScanText: "SCSC-1001",
            lastAcceptedScanAtMs: 1000,
            nowMs: 2400,
            repeatCooldownMs: 1500,
            shouldAutoRegisterAfterScan: false,
            memberSearchStatus: "empty",
            isSubmitting: false,
        }).accepted,
        false,
    );

    assert.deepEqual(
        resolveContinuousScanResult({
            decodedText: "SCSC-1001",
            lastAcceptedScanText: "SCSC-1001",
            lastAcceptedScanAtMs: 1000,
            nowMs: 2500,
            repeatCooldownMs: 1500,
            shouldAutoRegisterAfterScan: false,
            memberSearchStatus: "empty",
            isSubmitting: false,
        }),
        { accepted: true, value: "SCSC-1001" },
    );
});

test("shouldAutoRegisterScannedMember only triggers for validated scan results", () => {
    assert.equal(
        shouldAutoRegisterScannedMember({
            shouldAutoRegisterAfterScan: true,
            memberSearchStatus: "valid",
            hasSelectedMember: true,
            isSubmitting: false,
        }),
        true,
    );
    assert.equal(
        shouldAutoRegisterScannedMember({
            shouldAutoRegisterAfterScan: false,
            memberSearchStatus: "valid",
            hasSelectedMember: true,
            isSubmitting: false,
        }),
        false,
    );
    assert.equal(
        shouldAutoRegisterScannedMember({
            shouldAutoRegisterAfterScan: true,
            memberSearchStatus: "loading",
            hasSelectedMember: true,
            isSubmitting: false,
        }),
        false,
    );
    assert.equal(
        shouldAutoRegisterScannedMember({
            shouldAutoRegisterAfterScan: true,
            memberSearchStatus: "valid",
            hasSelectedMember: false,
            isSubmitting: false,
        }),
        false,
    );
    assert.equal(
        shouldAutoRegisterScannedMember({
            shouldAutoRegisterAfterScan: true,
            memberSearchStatus: "valid",
            hasSelectedMember: true,
            isSubmitting: true,
        }),
        false,
    );
});

test("shouldFailSubmittedAttendanceLookup only converts submitted invalid lookups to feedback", () => {
    assert.equal(
        shouldFailSubmittedAttendanceLookup({
            submitIntentActive: true,
            memberSearchStatus: "invalid",
            isSubmitting: false,
        }),
        true,
    );
    assert.equal(
        shouldFailSubmittedAttendanceLookup({
            submitIntentActive: true,
            memberSearchStatus: "error",
            isSubmitting: false,
        }),
        true,
    );
    assert.equal(
        shouldFailSubmittedAttendanceLookup({
            submitIntentActive: true,
            memberSearchStatus: "empty",
            isSubmitting: false,
        }),
        true,
    );
    assert.equal(
        shouldFailSubmittedAttendanceLookup({
            submitIntentActive: false,
            memberSearchStatus: "invalid",
            isSubmitting: false,
        }),
        false,
    );
    assert.equal(
        shouldFailSubmittedAttendanceLookup({
            submitIntentActive: true,
            memberSearchStatus: "loading",
            isSubmitting: false,
        }),
        false,
    );
    assert.equal(
        shouldFailSubmittedAttendanceLookup({
            submitIntentActive: true,
            memberSearchStatus: "invalid",
            isSubmitting: true,
        }),
        false,
    );
});

test("resolveAttendanceSubmissionOutcome handles silent duplicate scans", () => {
    assert.deepEqual(
        resolveAttendanceSubmissionOutcome({
            action: "check",
            hasCheckoutEndpoint: true,
            result: {
                success: false,
                message: "",
                checkResult: "Duplicated",
                silent: true,
            },
        }),
        { kind: "silent" },
    );
});

test("resolveAttendanceSubmissionOutcome maps reminders and confirmations", () => {
    assert.deepEqual(
        resolveAttendanceSubmissionOutcome({
            action: "check",
            hasCheckoutEndpoint: true,
            result: {
                success: false,
                message: "duplicate",
                checkResult: "Duplicated",
                reminder: { timeoutSeconds: 4.9 },
            },
        }),
        { kind: "reminder", message: "duplicate", timeoutSeconds: 4 },
    );

    assert.deepEqual(
        resolveAttendanceSubmissionOutcome({
            action: "check",
            hasCheckoutEndpoint: true,
            result: {
                success: false,
                message: "checkout?",
                checkResult: "Duplicated",
                confirmation: { action: "checkOut", timeoutSeconds: 30 },
            },
        }),
        {
            kind: "confirmation",
            action: "checkOut",
            message: "checkout?",
            timeoutSeconds: 30,
        },
    );
});

test("resolveAttendanceSubmissionOutcome falls back to feedback without checkout endpoint", () => {
    assert.deepEqual(
        resolveAttendanceSubmissionOutcome({
            action: "check",
            hasCheckoutEndpoint: false,
            result: {
                success: false,
                message: "duplicate",
                checkResult: "Duplicated",
                confirmation: { action: "checkOut", timeoutSeconds: 30 },
            },
        }),
        { kind: "feedback", tone: "warning", message: "duplicate" },
    );

    assert.deepEqual(
        resolveAttendanceSubmissionOutcome({
            action: "undo",
            hasCheckoutEndpoint: true,
            result: {
                success: true,
                message: "cancelled",
            },
        }),
        { kind: "feedback", tone: "success", message: "cancelled" },
    );
});

test("attendance duplicate windows use timezone-independent business wall-clock strings", () => {
    assert.equal(
        resolveOpenAttendanceDuplicateAction({
            attendedAt: "2026-06-28 14:00:00",
            now: "2026-06-28 14:00:01",
        }),
        "ignore",
    );
    assert.equal(
        resolveOpenAttendanceDuplicateAction({
            attendedAt: "2026-06-28 14:00:00",
            now: "2026-06-28 14:00:02",
        }),
        "warn",
    );
    assert.equal(
        isAttendanceCheckOutConfirmationRequired({
            attendedAt: "2026-06-28 14:00:00",
            now: "2026-06-28 14:30:00",
        }),
        true,
    );
    assert.equal(
        isAttendanceRegisterAgainConfirmationRequired({
            checkedOutAt: "2026-06-28 14:00:00",
            now: "2026-06-28 14:29:59",
        }),
        true,
    );
    assert.equal(
        resolveOpenAttendanceDuplicateAction({
            attendedAt: "2026-02-30 14:00:00",
            now: "2026-06-28 14:00:00",
        }),
        null,
    );
});

test("attendance undo window closes at one minute", () => {
    assert.equal(
        isAttendanceUndoAllowed({
            attendedAt: "2026-06-28 14:00:00",
            now: "2026-06-28 14:00:59",
        }),
        true,
    );
    assert.equal(
        isAttendanceUndoAllowed({
            attendedAt: "2026-06-28 14:00:00",
            now: "2026-06-28 14:01:00",
        }),
        false,
    );
    assert.equal(
        isAttendanceUndoAllowed({
            attendedAt: "2026-06-28 14:00:00",
            now: "2026-06-28 13:59:59",
        }),
        false,
    );
    assert.equal(
        getAttendanceUndoRemainingMs({
            attendedAt: "2026-06-28 14:00:00",
            nowMs: Date.UTC(2026, 5, 28, 14, 0, 30),
        }),
        30_000,
    );
});
