import { businessClockMs, parseBusinessSqlDateTime } from "./local-date.ts";

export type MemberAttendanceSearchStatus = "empty" | "loading" | "valid" | "invalid" | "error";
export type AttendanceCheckResult = "Success" | "Grace" | "Duplicated" | "Invalid";
export type AttendanceFeedbackTone = "success" | "warning" | "error";
export type AttendanceSubmissionAction = "check" | "undo" | "checkOut";
export const CONTINUOUS_SCAN_REPEAT_COOLDOWN_MS = 1500;
export const ATTENDANCE_CHECKOUT_CONFIRMATION_WINDOW_MINUTES = 30;
export const ATTENDANCE_CHECKOUT_AUTO_SECONDS = 30;
export const ATTENDANCE_DUPLICATE_IGNORE_MS = 1500;
export const ATTENDANCE_DUPLICATE_WARNING_SECONDS = 30;
export const ATTENDANCE_DUPLICATE_REMINDER_SECONDS = 5;
export const ATTENDANCE_UNDO_WINDOW_MS = 60 * 1000;

export type OpenAttendanceDuplicateAction =
    | "ignore"
    | "warn"
    | "confirm-checkout"
    | "direct-checkout";

export type AttendanceActionAutoTriggerInput = {
    shouldAutoRegisterAfterScan: boolean;
    memberSearchStatus: MemberAttendanceSearchStatus;
    hasSelectedMember: boolean;
    isSubmitting: boolean;
};

export type ContinuousScanInput = {
    decodedText: string;
    lastAcceptedScanText: string;
    lastAcceptedScanAtMs?: number | null;
    nowMs?: number;
    repeatCooldownMs?: number;
    shouldAutoRegisterAfterScan: boolean;
    memberSearchStatus: MemberAttendanceSearchStatus;
    isSubmitting: boolean;
};

export type ContinuousScanResult = {
    accepted: boolean;
    value: string;
};

export type AttendanceSubmissionResultPayload = {
    success: boolean;
    message: string;
    checkResult?: AttendanceCheckResult;
    feedbackTone?: AttendanceFeedbackTone;
    silent?: boolean;
    reminder?: {
        message?: string;
        timeoutSeconds?: number;
    };
    confirmation?: {
        action?: "checkOut" | "registerAgain";
        message?: string;
        timeoutSeconds?: number;
    };
};

export type AttendanceSubmissionOutcome =
    | { kind: "silent" }
    | { kind: "reminder"; message: string; timeoutSeconds: number }
    | {
        kind: "confirmation";
        action: "checkOut" | "registerAgain";
        message: string;
        timeoutSeconds: number;
    }
    | { kind: "feedback"; tone: AttendanceFeedbackTone; message: string };

export function mergeAttendanceSearchParamDict(
    item: {
        clientCode: string;
        param_dict?: Record<string, string | number | null>;
    },
    clientCodeLabel: string,
): Record<string, string | number | null> {
    return {
        [clientCodeLabel]: item.clientCode,
        ...(item.param_dict ?? {}),
    };
}

export function mergeAttendanceSearchOptions<T>(
    memberOptions: readonly T[],
    additionalOptions: readonly T[],
    limit: number,
): T[] {
    const resolvedLimit = Math.max(0, Math.trunc(limit));
    const merged: T[] = [];
    let memberIndex = 0;
    let additionalIndex = 0;

    while (
        merged.length < resolvedLimit &&
        (memberIndex < memberOptions.length || additionalIndex < additionalOptions.length)
    ) {
        if (memberIndex < memberOptions.length) {
            merged.push(memberOptions[memberIndex]);
            memberIndex += 1;
        }
        if (merged.length >= resolvedLimit) break;

        if (additionalIndex < additionalOptions.length) {
            merged.push(additionalOptions[additionalIndex]);
            additionalIndex += 1;
        }
    }

    return merged;
}

export function resolveAttendanceSearchExactMatch<T extends { clientCode: string }>(
    query: string,
    sources: readonly {
        options: readonly T[];
        exactMatch: T | null;
        exactMatchCount: number;
    }[],
): T | null {
    const normalizedQuery = query.trim().toUpperCase();
    const exactCodeMatches = sources
        .flatMap((source) => source.options)
        .filter(
            (item) => item.clientCode.trim().toUpperCase() === normalizedQuery,
        );

    if (exactCodeMatches.length > 0) {
        return exactCodeMatches.length === 1 ? exactCodeMatches[0] : null;
    }

    const exactNameCount = sources.reduce(
        (total, source) => total + Math.max(0, Math.trunc(source.exactMatchCount)),
        0,
    );
    if (exactNameCount !== 1) {
        return null;
    }

    return sources.find((source) => source.exactMatchCount === 1)?.exactMatch ?? null;
}

function getSqlDateTimeElapsedMs(input: {
    from: string;
    now: string;
}): number | null {
    const from = parseBusinessSqlDateTime(input.from);
    const now = parseBusinessSqlDateTime(input.now);
    if (from === null || now === null) {
        return null;
    }

    return now - from;
}

export function getAttendanceUndoRemainingMs(input: {
    attendedAt: string;
    nowMs?: number | null;
    windowMs?: number;
}): number {
    const attendedAtMs = parseBusinessSqlDateTime(input.attendedAt);
    const nowMs =
        typeof input.nowMs === "number" ? input.nowMs : businessClockMs(new Date());
    if (attendedAtMs === null || nowMs === null) {
        return 0;
    }

    const expiresAtMs = attendedAtMs + (input.windowMs ?? ATTENDANCE_UNDO_WINDOW_MS);
    return Math.max(0, expiresAtMs - nowMs);
}

export function isAttendanceUndoAllowed(input: {
    attendedAt: string;
    now: string;
    windowMs?: number;
}): boolean {
    const elapsedMs = getSqlDateTimeElapsedMs({
        from: input.attendedAt,
        now: input.now,
    });
    if (elapsedMs === null || elapsedMs < 0) {
        return false;
    }

    return elapsedMs < (input.windowMs ?? ATTENDANCE_UNDO_WINDOW_MS);
}

export function shouldAutoRegisterScannedMember(
    input: AttendanceActionAutoTriggerInput,
): boolean {
    return (
        input.shouldAutoRegisterAfterScan &&
        input.memberSearchStatus === "valid" &&
        input.hasSelectedMember &&
        !input.isSubmitting
    );
}

export function shouldFailSubmittedAttendanceLookup(input: {
    submitIntentActive: boolean;
    memberSearchStatus: MemberAttendanceSearchStatus;
    isSubmitting: boolean;
}): boolean {
    return (
        input.submitIntentActive &&
        !input.isSubmitting &&
        (
            input.memberSearchStatus === "empty" ||
            input.memberSearchStatus === "invalid" ||
            input.memberSearchStatus === "error"
        )
    );
}

export function getAttendanceFeedbackTone(
    checkResult: AttendanceCheckResult,
): AttendanceFeedbackTone {
    if (checkResult === "Success") return "success";
    if (checkResult === "Grace" || checkResult === "Duplicated") return "warning";
    return "error";
}

export function isAttendanceSuccessfulCheckResult(
    checkResult: AttendanceCheckResult,
): boolean {
    return checkResult === "Success" || checkResult === "Grace";
}

export function resolveAttendanceSubmissionOutcome(input: {
    action: AttendanceSubmissionAction;
    result: AttendanceSubmissionResultPayload;
    hasCheckoutEndpoint: boolean;
}): AttendanceSubmissionOutcome {
    const { action, result } = input;

    if (action === "check" && result.silent) {
        return { kind: "silent" };
    }

    if (action === "check" && result.reminder) {
        return {
            kind: "reminder",
            message: result.reminder.message ?? result.message,
            timeoutSeconds: Math.max(0, Math.floor(result.reminder.timeoutSeconds ?? 5)),
        };
    }

    if (action === "check" && result.confirmation && input.hasCheckoutEndpoint) {
        return {
            kind: "confirmation",
            action: result.confirmation.action ?? "checkOut",
            message: result.confirmation.message ?? result.message,
            timeoutSeconds: Math.max(0, Math.floor(result.confirmation.timeoutSeconds ?? 0)),
        };
    }

    return {
        kind: "feedback",
        tone: result.feedbackTone ??
            (result.checkResult
                ? getAttendanceFeedbackTone(result.checkResult)
                : result.success ? "success" : "error"),
        message: result.message,
    };
}

export function resolveOpenAttendanceDuplicateAction(input: {
    attendedAt: string;
    now: string;
    ignoreMs?: number;
    warningSeconds?: number;
    checkoutWindowMinutes?: number;
}): OpenAttendanceDuplicateAction | null {
    const elapsedMs = getSqlDateTimeElapsedMs({
        from: input.attendedAt,
        now: input.now,
    });
    if (elapsedMs === null || elapsedMs < 0) {
        return null;
    }

    const ignoreMs = input.ignoreMs ?? ATTENDANCE_DUPLICATE_IGNORE_MS;
    if (elapsedMs < ignoreMs) {
        return "ignore";
    }

    const warningMs =
        (input.warningSeconds ?? ATTENDANCE_DUPLICATE_WARNING_SECONDS) * 1000;
    if (elapsedMs < warningMs) {
        return "warn";
    }

    const checkoutWindowMs =
        (input.checkoutWindowMinutes ?? ATTENDANCE_CHECKOUT_CONFIRMATION_WINDOW_MINUTES) *
        60 *
        1000;
    if (elapsedMs <= checkoutWindowMs) {
        return "confirm-checkout";
    }

    return "direct-checkout";
}

export function isAttendanceCheckOutConfirmationRequired(input: {
    attendedAt: string;
    now: string;
    windowMinutes?: number;
}): boolean {
    return resolveOpenAttendanceDuplicateAction({
        attendedAt: input.attendedAt,
        now: input.now,
        checkoutWindowMinutes: input.windowMinutes,
    }) === "confirm-checkout";
}

export function isAttendanceRegisterAgainConfirmationRequired(input: {
    checkedOutAt: string;
    now: string;
    windowMinutes?: number;
}): boolean {
    const elapsedMs = getSqlDateTimeElapsedMs({
        from: input.checkedOutAt,
        now: input.now,
    });
    if (elapsedMs === null || elapsedMs < 0) {
        return false;
    }

    const windowMs =
        (input.windowMinutes ?? ATTENDANCE_CHECKOUT_CONFIRMATION_WINDOW_MINUTES) *
        60 *
        1000;
    return elapsedMs < windowMs;
}

export function resolveContinuousScanResult(
    input: ContinuousScanInput,
): ContinuousScanResult {
    const value = input.decodedText.trim();

    if (!value) {
        return { accepted: false, value: "" };
    }

    const repeatedScanCoolingDown =
        value === input.lastAcceptedScanText &&
        (
            typeof input.lastAcceptedScanAtMs !== "number" ||
            (input.nowMs ?? Date.now()) - input.lastAcceptedScanAtMs <
                (input.repeatCooldownMs ?? CONTINUOUS_SCAN_REPEAT_COOLDOWN_MS)
        );

    if (
        repeatedScanCoolingDown ||
        input.shouldAutoRegisterAfterScan ||
        input.memberSearchStatus === "loading" ||
        input.isSubmitting
    ) {
        return { accepted: false, value };
    }

    return { accepted: true, value };
}
