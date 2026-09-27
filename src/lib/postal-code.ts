/** Canadian postal codes: A1A1A1 or A1A 1A1. Empty values remain optional. */
export const CANADIAN_POSTAL_CODE_PATTERN = "[A-Za-z]\\d[A-Za-z] ?\\d[A-Za-z]\\d";

export function isValidCanadianPostalCode(value: string | null | undefined): boolean {
    const normalized = value?.trim() ?? "";
    return normalized === "" || new RegExp(`^${CANADIAN_POSTAL_CODE_PATTERN}$`).test(normalized);
}

export function normalizeCanadianPostalCode(value: string | null | undefined): string {
    const normalized = (value?.trim() ?? "").toUpperCase();
    return isValidCanadianPostalCode(normalized) ? normalized.replace(" ", "") : normalized;
}
