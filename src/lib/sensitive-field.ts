const ISO_DOB_PATTERN = /^\d{4}-\d{2}-(\d{2})$/;

export function maskDobDayOnly(dob: string): string {
    const match = ISO_DOB_PATTERN.exec(dob);
    return match ? `****-**-${match[1]}` : "****-**-**";
}

export function maskPhone(value: string | null | undefined): string | null {
    const normalized = value?.trim() ?? "";
    if (!normalized) return null;
    const digits = normalized.replace(/\D/g, "");
    if (!digits) return "••••";
    const visibleDigits = Math.min(4, Math.max(0, digits.length - 1));
    return `••••${visibleDigits > 0 ? digits.slice(-visibleDigits) : ""}`;
}

export function maskEmailLocalSuffix(value: string | null | undefined): string | null {
    const normalized = value?.trim() ?? "";
    if (!normalized) return null;

    const at = normalized.indexOf("@");
    if (at <= 0 || at === normalized.length - 1) return "••••";

    const localCharacters = Array.from(normalized.slice(0, at));
    const visibleCount = localCharacters.length <= 6
        ? Math.floor(localCharacters.length / 2)
        : 4;
    const visibleSuffix = visibleCount > 0
        ? localCharacters.slice(-visibleCount).join("")
        : "";

    return `••••${visibleSuffix}${normalized.slice(at)}`;
}
