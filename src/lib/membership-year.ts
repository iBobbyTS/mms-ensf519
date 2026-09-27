export const MIN_MEMBERSHIP_YEAR = 1900;
export const MAX_MEMBERSHIP_YEAR = 2100;

export function cleanMembershipYear(value: unknown): number | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const trimmed = String(value).trim();
    if (!/^\d{4}$/.test(trimmed)) return null;
    const year = Number(trimmed);
    return Number.isInteger(year) &&
        year >= MIN_MEMBERSHIP_YEAR &&
        year <= MAX_MEMBERSHIP_YEAR
        ? year
        : null;
}
