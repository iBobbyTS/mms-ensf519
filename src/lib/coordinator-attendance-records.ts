import type {
    DateRangeFilterValue,
    FilterState,
} from "@ibobbyts/svelte-ui-utils/table";

import { formatBusinessDate } from "./local-date.ts";

export type CoordinatorAttendanceRecordsFilters = {
    dateFrom: string;
    dateTo: string;
    participantKey: string | null;
    page: number;
    limit: number;
};

const MAX_LIMIT = 100;

/**
 * Coordinates the single in-flight attendance-record request while the page
 * remains the owner of committed rows and filters.
 */
export function createCoordinatorAttendanceRecordsRequestCoordinator() {
    let sequence = 0;
    let activeController: AbortController | null = null;
    let active = true;

    return {
        start() {
            activeController?.abort();
            const controller = new AbortController();
            activeController = controller;
            return { controller, sequence: ++sequence };
        },
        isCurrent(requestSequence: number) {
            return active && requestSequence === sequence;
        },
        complete(requestSequence: number) {
            if (requestSequence === sequence) activeController = null;
        },
        teardown() {
            if (!active) return;
            active = false;
            sequence += 1;
            activeController?.abort();
            activeController = null;
        },
    };
}

function cleanDate(value: string | null | undefined): string | null {
    const trimmed = value?.trim() ?? "";
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function cleanPositiveInteger(value: unknown, fallback: number, max?: number): number {
    const parsed = Number(value ?? "");
    if (!Number.isInteger(parsed) || parsed < 1) return fallback;
    return max ? Math.min(parsed, max) : parsed;
}

export function cleanCoordinatorAttendanceParticipantKey(
    value: unknown,
): string | null {
    const text = typeof value === "string" || typeof value === "number"
        ? String(value).trim()
        : "";
    if (!text) return null;
    if (/^(client|child):\d+$/.test(text)) return text;
    if (/^code:[^:]+$/.test(text)) return text;
    return null;
}

export function coordinatorAttendanceRecordsDefaultDateRange(
    now = new Date(),
): DateRangeFilterValue {
    const currentDate = formatBusinessDate(now);
    const year = Number(currentDate.slice(0, 4));
    const month = Number(currentDate.slice(5, 7));
    const monthText = currentDate.slice(5, 7);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return {
        startDate: `${year}-${monthText}-01`,
        endDate: `${year}-${monthText}-${String(lastDay).padStart(2, "0")}`,
        preset: "thisMonth",
    };
}

export function parseCoordinatorAttendanceRecordsSearchParams(
    searchParams: URLSearchParams,
    options: {
        defaultDateRange?: DateRangeFilterValue;
        limit: number;
    },
): CoordinatorAttendanceRecordsFilters {
    const defaultDateRange =
        options.defaultDateRange ?? coordinatorAttendanceRecordsDefaultDateRange();
    const dateFrom = cleanDate(searchParams.get("date_from")) ?? defaultDateRange.startDate;
    const dateTo = cleanDate(searchParams.get("date_to")) ?? defaultDateRange.endDate;

    return {
        dateFrom,
        dateTo,
        participantKey: cleanCoordinatorAttendanceParticipantKey(
            searchParams.get("participant"),
        ),
        page: cleanPositiveInteger(searchParams.get("page"), 1),
        limit: cleanPositiveInteger(options.limit, 20, MAX_LIMIT),
    };
}

export function coordinatorAttendanceRecordFilterState(
    filters: CoordinatorAttendanceRecordsFilters,
    defaultDateRange = coordinatorAttendanceRecordsDefaultDateRange(),
): FilterState {
    const isDefaultDateRange =
        filters.dateFrom === defaultDateRange.startDate &&
        filters.dateTo === defaultDateRange.endDate;

    return {
        dateRange: {
            startDate: filters.dateFrom,
            endDate: filters.dateTo,
            preset: isDefaultDateRange ? defaultDateRange.preset : null,
        } satisfies DateRangeFilterValue,
        participant: filters.participantKey ?? "",
    };
}

export function coordinatorAttendanceRecordsFiltersFromState(input: {
    filters?: FilterState;
    page?: unknown;
    limit?: unknown;
    defaultDateRange?: DateRangeFilterValue;
}): CoordinatorAttendanceRecordsFilters {
    const filters = input.filters ?? {};
    const dateRange = filters.dateRange as DateRangeFilterValue | undefined;
    const defaultDateRange =
        input.defaultDateRange ?? coordinatorAttendanceRecordsDefaultDateRange();
    return {
        dateFrom: cleanDate(dateRange?.startDate) ?? defaultDateRange.startDate,
        dateTo: cleanDate(dateRange?.endDate) ?? defaultDateRange.endDate,
        participantKey: cleanCoordinatorAttendanceParticipantKey(filters.participant),
        page: cleanPositiveInteger(input.page, 1),
        limit: cleanPositiveInteger(input.limit, 20, MAX_LIMIT),
    };
}

export function buildCoordinatorAttendanceRecordsSearchParams(
    filters: FilterState,
    options: {
        page?: number | string;
        limit?: number | string;
        defaultDateRange?: DateRangeFilterValue;
    },
): URLSearchParams {
    const parsed = coordinatorAttendanceRecordsFiltersFromState({
        filters,
        page: options.page ?? 1,
        limit: options.limit ?? 20,
        defaultDateRange: options.defaultDateRange,
    });
    const params = new URLSearchParams({
        page: String(parsed.page),
        limit: String(parsed.limit),
        date_from: parsed.dateFrom,
        date_to: parsed.dateTo,
    });
    if (parsed.participantKey) {
        params.set("participant", parsed.participantKey);
    }
    return params;
}

export function buildCoordinatorAttendanceRecordsQueryKey(
    filters: FilterState,
    refreshVersion = 0,
): string {
    const params = buildCoordinatorAttendanceRecordsSearchParams(filters, {
        page: 1,
        limit: 20,
    });
    params.delete("page");
    params.delete("limit");
    if (Number.isInteger(refreshVersion) && refreshVersion > 0) {
        params.set("refresh", String(refreshVersion));
    }
    return params.toString();
}

export function isCoordinatorAttendanceCheckOutTime(value: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}
