/** Lightweight email format check shared by profile save boundaries. */
export function isValidEmail(value: string | null | undefined): boolean {
    const normalized = value?.trim() ?? "";
    return normalized === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}
