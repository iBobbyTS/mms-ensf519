import {
    ATTENDANCE_DUPLICATE_IGNORE_MS,
    ATTENDANCE_DUPLICATE_REMINDER_SECONDS,
    ATTENDANCE_DUPLICATE_WARNING_SECONDS,
} from "$lib/member-attendance";
import { parseBusinessSqlDateTime } from "$lib/local-date";

export const INTEREST_GROUP_REPEAT_CHECK_IN_WINDOW_MINUTES = 60;

export type InterestGroupDuplicateCheckInAction =
    | "ignore"
    | "warn"
    | "duplicate"
    | "allow";

export function resolveInterestGroupDuplicateCheckInAction(input: {
    attendedAt: string;
    now: string;
    ignoreMs?: number;
    warningSeconds?: number;
    repeatWindowMinutes?: number;
}): InterestGroupDuplicateCheckInAction {
    const attendedAt = parseBusinessSqlDateTime(input.attendedAt);
    const now = parseBusinessSqlDateTime(input.now);
    if (attendedAt === null || now === null || now < attendedAt) {
        return "duplicate";
    }

    const elapsedMs = now - attendedAt;
    if (elapsedMs < (input.ignoreMs ?? ATTENDANCE_DUPLICATE_IGNORE_MS)) {
        return "ignore";
    }

    if (elapsedMs < (input.warningSeconds ?? ATTENDANCE_DUPLICATE_WARNING_SECONDS) * 1000) {
        return "warn";
    }

    const repeatWindowMs =
        (input.repeatWindowMinutes ?? INTEREST_GROUP_REPEAT_CHECK_IN_WINDOW_MINUTES) *
        60 *
        1000;
    return elapsedMs < repeatWindowMs ? "duplicate" : "allow";
}

export function buildInterestGroupDuplicateReminder(): { timeoutSeconds: number } {
    return {
        timeoutSeconds: ATTENDANCE_DUPLICATE_REMINDER_SECONDS,
    };
}
