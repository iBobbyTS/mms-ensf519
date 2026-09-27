import { formatBusinessDate } from "./local-date.ts";

export const INTEREST_GROUP_REPORT_MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export type InterestGroupReportPeriod = {
    year: number;
    month: number;
};

export type InterestGroupReportDateRange = {
    startDate: string;
    endDate: string;
};

export type InterestGroupReportSortKey =
    | "name"
    | "attendanceCount"
    | "uniqueMemberCount";

export type InterestGroupReportSort = {
    key: InterestGroupReportSortKey;
    direction: "asc" | "desc";
};

export type InterestGroupReportSortableRow = {
    id: number;
    name: string;
    attendanceCount: number;
    uniqueMemberCount: number;
};

export type InterestGroupYearlyReportMonth = {
    month: number;
    attendanceCount: number;
    uniqueMemberCount: number;
};

export type InterestGroupYearlyReportRow = {
    id: number;
    name: string;
    months: InterestGroupYearlyReportMonth[];
};

export type InterestGroupReportMetric = "attendanceCount" | "uniqueMemberCount";

export type InterestGroupReportChartEntry = {
    id: number;
    name: string;
    seriesIndex: number;
    value: number;
};

export type InterestGroupReportChartPeriod = {
    year: number;
    startMonth: number;
    endMonth: number;
};

export function interestGroupReportSeriesColor(index: number): string {
    return `hsl(${(index * 137.508) % 360} 68% 42%)`;
}

export function interestGroupReportLegendColumns(
    itemCount: number,
    columnCount: number,
): number[][] {
    const normalizedItemCount = Math.max(0, Math.trunc(itemCount));
    const normalizedColumnCount = Math.min(
        normalizedItemCount,
        Math.max(1, Math.trunc(columnCount)),
    );
    if (normalizedItemCount === 0) return [];

    return Array.from({ length: normalizedColumnCount }, (_, columnIndex) =>
        Array.from({ length: normalizedItemCount }, (_, itemIndex) => itemIndex).filter(
            (itemIndex) => itemIndex % normalizedColumnCount === columnIndex,
        ),
    );
}

export function interestGroupReportLegendDividerRowCounts(
    itemCount: number,
    columnCount: number,
): number[] {
    const columns = interestGroupReportLegendColumns(itemCount, columnCount);
    return columns.slice(0, -1).map((column, index) =>
        Math.max(column.length, columns[index + 1]?.length ?? 0),
    );
}

export function interestGroupReportChartPeriod(
    year: number,
    monthCount: number,
    hoveredMonthIndex: number | null,
): InterestGroupReportChartPeriod {
    const normalizedMonthCount = Math.min(Math.max(Math.trunc(monthCount), 1), 12);
    const hoveredMonth =
        Number.isInteger(hoveredMonthIndex) &&
        hoveredMonthIndex !== null &&
        hoveredMonthIndex >= 0 &&
        hoveredMonthIndex < normalizedMonthCount
            ? hoveredMonthIndex + 1
            : null;

    return {
        year,
        startMonth: hoveredMonth ?? 1,
        endMonth: hoveredMonth ?? normalizedMonthCount,
    };
}

export function currentBusinessMonth(now = new Date()): number {
    return Number(formatBusinessDate(now).slice(5, 7));
}

export function isInterestGroupReportYear(value: number): boolean {
    return Number.isInteger(value) && value >= 1900 && value <= 2100;
}

export function isInterestGroupReportMonth(value: number): boolean {
    return Number.isInteger(value) && value >= 1 && value <= 12;
}

export function resolveInterestGroupReportPeriod(
    input: {
        year?: string | null;
        month?: string | null;
    },
    now = new Date(),
): InterestGroupReportPeriod {
    const defaultYear = Number(formatBusinessDate(now).slice(0, 4));
    const defaultMonth = currentBusinessMonth(now);
    const yearText = input.year?.trim() ?? "";
    const monthText = input.month?.trim() ?? "";
    const requestedYear = /^\d{4}$/.test(yearText) ? Number(yearText) : Number.NaN;
    const requestedMonth = /^\d{1,2}$/.test(monthText) ? Number(monthText) : Number.NaN;

    return {
        year: isInterestGroupReportYear(requestedYear) ? requestedYear : defaultYear,
        month: isInterestGroupReportMonth(requestedMonth) ? requestedMonth : defaultMonth,
    };
}

export function mergeInterestGroupReportYears(
    years: Iterable<number>,
    currentYear: number,
): number[] {
    const candidates = new Set<number>();
    for (const year of years) {
        if (isInterestGroupReportYear(year)) {
            candidates.add(year);
        }
    }
    if (isInterestGroupReportYear(currentYear)) {
        candidates.add(currentYear);
    }
    return [...candidates].sort((left, right) => left - right);
}

export function interestGroupReportDateRange(
    period: InterestGroupReportPeriod,
): InterestGroupReportDateRange {
    const monthText = String(period.month).padStart(2, "0");
    const lastDay = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
    return {
        startDate: `${period.year}-${monthText}-01`,
        endDate: `${period.year}-${monthText}-${String(lastDay).padStart(2, "0")}`,
    };
}

export function sortInterestGroupReportRows<T extends InterestGroupReportSortableRow>(
    rows: T[],
    sort: InterestGroupReportSort,
): T[] {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
        const comparison =
            sort.key === "name"
                ? left.name.localeCompare(right.name)
                : left[sort.key] - right[sort.key];
        return comparison * direction || left.name.localeCompare(right.name) || left.id - right.id;
    });
}

export function closestInterestGroupReportMonthIndex(
    position: number,
    plotStart: number,
    plotWidth: number,
    monthCount = 12,
): number {
    const normalizedMonthCount = Math.min(Math.max(Math.trunc(monthCount), 1), 12);
    if (
        !Number.isFinite(position) ||
        !Number.isFinite(plotStart) ||
        plotWidth <= 0 ||
        normalizedMonthCount === 1
    ) {
        return 0;
    }
    const relativePosition = Math.min(Math.max(position - plotStart, 0), plotWidth);
    return Math.round((relativePosition / plotWidth) * (normalizedMonthCount - 1));
}

export function interestGroupReportChartEntries(
    rows: InterestGroupYearlyReportRow[],
    monthIndex: number,
    metric: InterestGroupReportMetric,
): InterestGroupReportChartEntry[] {
    if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return [];

    return rows
        .map((row, seriesIndex) => ({
            id: row.id,
            name: row.name,
            seriesIndex,
            value: row.months[monthIndex]?.[metric] ?? 0,
        }))
        .filter((entry) => entry.value > 0)
        .sort((left, right) =>
            right.value - left.value || left.name.localeCompare(right.name) || left.id - right.id
        );
}

export function interestGroupReportVisibleTotal(
    row: InterestGroupYearlyReportRow,
    metric: InterestGroupReportMetric,
    monthCount: number,
): number {
    const normalizedMonthCount = Math.min(Math.max(Math.trunc(monthCount), 0), 12);
    return row.months
        .slice(0, normalizedMonthCount)
        .reduce((total, month) => {
            const value = month[metric];
            return Number.isFinite(value) ? total + value : total;
        }, 0);
}
