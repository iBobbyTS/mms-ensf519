import {
    businessClockMs,
    formatBusinessDate,
    parseBusinessSqlDateTime,
} from "./local-date.ts";

export const ACTIVITY_LIST_SORT_FIELDS = [
    "name",
    "project_id",
    "created_at",
    "held_at",
    "expected_participants",
    "registration_count",
    "attendance_count",
] as const;

export type ActivityListSortField = (typeof ACTIVITY_LIST_SORT_FIELDS)[number];
export type ActivityListSortDirection = "asc" | "desc";

export type ActivitySelectionCandidate = {
    id: number;
    held_at: string | null;
};

export function activityHeldAtLabel(heldAt: string | null, longTermLabel: string): string {
    return heldAt ?? longTermLabel;
}

const ACTIVITY_LIST_SORT_FIELD_SET = new Set<string>(ACTIVITY_LIST_SORT_FIELDS);

export function resolveActivityListSort(input: {
    sort: string | null;
    dir: string | null;
}): {
    sort: ActivityListSortField;
    dir: ActivityListSortDirection;
} {
    const sort = ACTIVITY_LIST_SORT_FIELD_SET.has(input.sort ?? "")
        ? (input.sort as ActivityListSortField)
        : "held_at";
    const dir = input.dir === "asc" ? "asc" : "desc";

    return { sort, dir };
}

export function nextActivitySortDirection(input: {
    currentSort: ActivityListSortField;
    currentDir: ActivityListSortDirection;
    column: ActivityListSortField;
}): ActivityListSortDirection {
    if (input.currentSort !== input.column) {
        return "asc";
    }
    return input.currentDir === "asc" ? "desc" : "asc";
}

export function resolveActivityCheckInSelection(input: {
    activities: ActivitySelectionCandidate[];
    requestedActivityId: number | null;
    now: Date;
}): {
    activityId: number | null;
} {
    const requestedActivity = input.activities.find(
        (activity) => activity.id === input.requestedActivityId,
    );
    if (requestedActivity) {
        return { activityId: requestedActivity.id };
    }

    const today = formatBusinessDate(input.now);
    const todayActivities = input.activities
        .filter((activity) => activity.held_at?.slice(0, 10) === today)
        .map((activity) => ({
            ...activity,
            heldAtMs: parseBusinessSqlDateTime(activity.held_at ?? ""),
        }))
        .filter(
            (activity): activity is ActivitySelectionCandidate & { heldAtMs: number } =>
                activity.heldAtMs !== null,
        )
        .sort((left, right) => left.heldAtMs - right.heldAtMs || left.id - right.id);

    if (todayActivities.length === 0) {
        return { activityId: null };
    }

    let selected = todayActivities[0];
    const nowMs = businessClockMs(input.now);
    if (nowMs === null) {
        return { activityId: selected.id };
    }

    for (let index = 0; index < todayActivities.length - 1; index += 1) {
        const current = todayActivities[index];
        const next = todayActivities[index + 1];
        const threshold = current.heldAtMs + 0.8 * (next.heldAtMs - current.heldAtMs);
        if (nowMs > threshold) {
            selected = next;
        } else {
            break;
        }
    }

    return { activityId: selected.id };
}

export function summarizeActivityParticipation(records: Array<{
    registrationStatus: string;
    attendanceStatus: string;
    wasRegisteredWhenAttended: boolean;
}>): {
    registrationCount: number;
    attendanceCount: number;
    walkInAttendanceCount: number;
} {
    return records.reduce(
        (summary, record) => ({
            registrationCount:
                summary.registrationCount +
                (record.registrationStatus === "active" ? 1 : 0),
            attendanceCount:
                summary.attendanceCount +
                (record.attendanceStatus === "active" ? 1 : 0),
            walkInAttendanceCount:
                summary.walkInAttendanceCount +
                (record.attendanceStatus === "active" &&
                !record.wasRegisteredWhenAttended
                    ? 1
                    : 0),
        }),
        {
            registrationCount: 0,
            attendanceCount: 0,
            walkInAttendanceCount: 0,
        },
    );
}
