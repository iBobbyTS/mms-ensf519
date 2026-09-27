export const RESIDENTIAL_STATUS_VALUES = [
    "Citizen",
    "Permanent Resident",
    "Visitor",
    "International Student",
] as const;

export type ResidentialStatus = (typeof RESIDENTIAL_STATUS_VALUES)[number];

export const LEGACY_CITIZEN_PERMANENT_RESIDENT_STATUS = "Citizen_Permanent Resident";
export const LEGACY_TEMPORARY_RESIDENT_STATUS = "Temporary Resident";

export function isResidentialStatus(
    value: string | null | undefined,
): value is ResidentialStatus {
    return RESIDENTIAL_STATUS_VALUES.includes(value as ResidentialStatus);
}

export function normalizeResidentialStatusValue(
    value: string | null | undefined,
): ResidentialStatus | "" {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) return "";
    if (trimmed === LEGACY_CITIZEN_PERMANENT_RESIDENT_STATUS) return "Permanent Resident";
    // Leave unmapped legacy statuses empty in edit forms so operators must choose
    // one of the current statuses before saving.
    if (isResidentialStatus(trimmed)) return trimmed;
    return "";
}

export function normalizeResidentialStatusForStorage(
    value: string | null | undefined,
): ResidentialStatus | null {
    const normalized = normalizeResidentialStatusValue(value);
    if (normalized) return normalized;
    if (!value?.trim()) return null;
    throw new Error("invalid_residential_status");
}
