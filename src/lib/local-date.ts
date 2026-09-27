function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

export const BUSINESS_TIME_ZONE = "America/Edmonton";

type BusinessDateTimeParts = {
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    second: string;
};

const businessDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
});

function businessDateTimeParts(date: Date): BusinessDateTimeParts {
    const parts = Object.fromEntries(
        businessDateTimeFormatter
            .formatToParts(date)
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, part.value]),
    );

    return {
        year: parts.year ?? "0000",
        month: parts.month ?? "00",
        day: parts.day ?? "00",
        hour: parts.hour ?? "00",
        minute: parts.minute ?? "00",
        second: parts.second ?? "00",
    };
}

export function formatBusinessDate(date: Date): string {
    const parts = businessDateTimeParts(date);
    return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatBusinessDateTime(date: Date): string {
    const parts = businessDateTimeParts(date);
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function todayBusinessDate(now = new Date()): string {
    return formatBusinessDate(now);
}

export function currentBusinessYear(now = new Date()): number {
    return Number(formatBusinessDate(now).slice(0, 4));
}

function parseSqlDate(value: string): { year: number; month: number; day: number } | null {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const timestamp = Date.UTC(year, month - 1, day);
    const parsed = new Date(timestamp);

    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        return null;
    }

    return { year, month, day };
}

export function addBusinessDateDays(date: string, days: number): string | null {
    const parsed = parseSqlDate(date);
    if (!parsed || !Number.isFinite(days)) return null;

    const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
    return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

export function businessDateDaysBefore(now: Date, days: number): string {
    return addBusinessDateDays(formatBusinessDate(now), -Math.trunc(days)) ?? formatBusinessDate(now);
}

export function parseBusinessSqlDateTime(value: string): number | null {
    const match = value
        .trim()
        .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;

    const [, yearText, monthText, dayText, hourText, minuteText, secondText = "0"] =
        match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    const timestamp = Date.UTC(year, month - 1, day, hour, minute, second);
    const parsed = new Date(timestamp);

    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day ||
        parsed.getUTCHours() !== hour ||
        parsed.getUTCMinutes() !== minute ||
        parsed.getUTCSeconds() !== second
    ) {
        return null;
    }

    return timestamp;
}

export function businessClockMs(date: Date): number | null {
    return parseBusinessSqlDateTime(formatBusinessDateTime(date));
}

export function formatLocalDate(date: Date): string {
    return formatBusinessDate(date);
}

export function formatLocalDateTime(date: Date): string {
    return formatBusinessDateTime(date);
}

export function todayLocalDate(now = new Date()): string {
    return todayBusinessDate(now);
}
