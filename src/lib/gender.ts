export const GENDER_VALUES = ["Male", "Female", "Other"] as const;

export type Gender = (typeof GENDER_VALUES)[number];

export const MEMBER_GENDER_VALUES = [
    "Male",
    "Female",
    "Transgender",
    "Prefer not to disclose",
    "Other",
] as const;

export type MemberGender = (typeof MEMBER_GENDER_VALUES)[number];
export const FSII_GENDER_DETAIL_VALUES = ["Transgender", "Prefer not to disclose"] as const;
export type FsiiGenderDetail = (typeof FSII_GENDER_DETAIL_VALUES)[number];

const GENDER_ALIASES: Record<string, Gender> = {
    male: "Male",
    m: "Male",
    男: "Male",
    female: "Female",
    f: "Female",
    女: "Female",
    other: "Other",
    transgender: "Other",
    "prefer not disclose": "Other",
    "prefer not to disclose": "Other",
    "不愿透露": "Other",
    "不願透露": "Other",
    跨性别: "Other",
    跨性別: "Other",
    其他: "Other",
};

const MEMBER_GENDER_ALIASES: Record<string, MemberGender> = {
    ...GENDER_ALIASES,
    transgender: "Transgender",
    "prefer not disclose": "Prefer not to disclose",
    "prefer not to disclose": "Prefer not to disclose",
    "不愿透露": "Prefer not to disclose",
    "不願透露": "Prefer not to disclose",
    跨性别: "Transgender",
    跨性別: "Transgender",
};

function normalizeGenderKey(value: string | null | undefined): string {
    return value?.trim().toLowerCase() ?? "";
}

export function isGender(value: string | null | undefined): value is Gender {
    return GENDER_VALUES.includes(value as Gender);
}

export function normalizeGenderValue(value: string | null | undefined): Gender | "" {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) return "";
    if (isGender(trimmed)) return trimmed;
    return GENDER_ALIASES[normalizeGenderKey(trimmed)] ?? "";
}

export function normalizeGenderForStorage(value: string | null | undefined): Gender | null {
    const normalized = normalizeGenderValue(value);
    if (normalized) return normalized;
    if (!value?.trim()) return null;
    throw new Error("invalid_gender");
}

export function isMemberGender(value: string | null | undefined): value is MemberGender {
    return MEMBER_GENDER_VALUES.includes(value as MemberGender);
}

export function normalizeMemberGenderValue(
    value: string | null | undefined,
): MemberGender | "" {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) return "";
    if (isMemberGender(trimmed)) return trimmed;

    const normalized = MEMBER_GENDER_ALIASES[normalizeGenderKey(trimmed)];
    return normalized ?? "";
}

export function normalizeMemberGenderForStorage(
    value: string | null | undefined,
): MemberGender | null {
    const normalized = normalizeMemberGenderValue(value);
    if (normalized) return normalized;
    if (!value?.trim()) return null;
    throw new Error("invalid_member_gender");
}

export function projectMemberGenderForStorage(value: string | null | undefined): {
    gender: Gender | null;
    fsiiGenderDetail: FsiiGenderDetail | null;
} {
    const normalized = normalizeMemberGenderForStorage(value);
    if (normalized === "Transgender" || normalized === "Prefer not to disclose") {
        return { gender: "Other", fsiiGenderDetail: normalized };
    }
    return { gender: normalized, fsiiGenderDetail: null };
}

export function restoreMemberGender(
    gender: string | null | undefined,
    fsiiGenderDetail: string | null | undefined,
): MemberGender | "" {
    if (fsiiGenderDetail === "Transgender" || fsiiGenderDetail === "Prefer not to disclose") {
        return fsiiGenderDetail;
    }
    return normalizeGenderValue(gender);
}

export function coerceGenderForMigration(value: string | null | undefined): Gender | null {
    const normalized = normalizeGenderValue(value);
    if (normalized) return normalized;
    if (!value?.trim()) return null;
    return "Other";
}
