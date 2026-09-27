import { todayBusinessDate } from "./local-date.ts";
import {
    createEmptyPersonalProfileData,
    normalizePersonalProfileData,
    type PersonalProfileData,
    type PersonalProfileDataSource,
} from "./client-form.ts";
import {
    FSII_OTHER_GENDER_MAX_LENGTH,
    isFsiiAccessibilityDifficulty,
    isFsiiIndigenousIdentity,
    isGradeInSchool,
    isIsoCalendarMonth,
} from "./fsii-member-demographics.ts";
import {
    normalizeMemberGenderValue,
    type FsiiGenderDetail,
} from "./gender.ts";
import { isResidentialStatus } from "./residential-status.ts";
import { isValidCanadianPostalCode, normalizeCanadianPostalCode } from "./postal-code.ts";
import { isValidEmail } from "./email.ts";

export const TEMPORARY_PARTICIPANT_CODE_PREFIX = "TMP";
export const TEMPORARY_PARTICIPANT_MIN_BIRTH_YEAR = 1900;
export const TEMPORARY_PARTICIPANT_LEGAL_NAME_MAX_LENGTH = 200;
export const TEMPORARY_PARTICIPANT_LEGAL_NAME_PATTERN =
    "(?=.*[A-Za-z])[A-Za-z '\\-]+";
export const TEMPORARY_PARTICIPANT_TEL_MAX_LENGTH = 50;
export const TEMPORARY_PARTICIPANT_EMAIL_MAX_LENGTH = 254;
export const TEMPORARY_PARTICIPANT_WECHAT_ID_MAX_LENGTH = 100;

// Shared "dob age only" contract (members and temporary participants):
// the checkbox is detected by FormData key presence, and dobAge carries the
// whole-number age text (0..120) when the checkbox is on.
export const DOB_AGE_ONLY_FIELD = "dobAgeOnly";
export const DOB_AGE_FIELD = "dobAge";
export const DOB_AGE_ONLY_MIN = 0;
export const DOB_AGE_ONLY_MAX = 120;

export function parseDobAgeYears(value: string | null | undefined): number | null {
    const trimmed = value?.trim() ?? "";
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) &&
        parsed >= DOB_AGE_ONLY_MIN &&
        parsed <= DOB_AGE_ONLY_MAX
        ? parsed
        : null;
}

export type DobAgeInput = {
    dobAgeOnly?: boolean | null;
    dobAge?: string | null;
};

export type DobAgePreviousState = {
    ageYears: number | null;
    ageUpdatedDate: string | null;
} | null;

export type DobAgeWriteValues = {
    ageYears: number | null;
    ageUpdatedDate: string | null;
};

// Server-side restamp truth table for age_updated_date. The date is never read
// from the client submission: switching to age mode or changing the age stamps
// the business "today"; resubmitting the same age keeps the previous date;
// switching back to dob mode clears both age columns.
export function resolveDobAgeWriteValues(
    input: DobAgeInput,
    previous: DobAgePreviousState,
    today: string,
): DobAgeWriteValues {
    if (!input.dobAgeOnly) return { ageYears: null, ageUpdatedDate: null };
    const ageYears = parseDobAgeYears(input.dobAge);
    if (ageYears === null) return { ageYears: null, ageUpdatedDate: null };
    if (previous?.ageYears == null || previous.ageYears !== ageYears) {
        return { ageYears, ageUpdatedDate: today };
    }
    return { ageYears, ageUpdatedDate: previous.ageUpdatedDate ?? today };
}

export type TemporaryParticipantGender = "Male" | "Female" | "Other";

export function isTemporaryParticipantGender(
    value: unknown,
): value is TemporaryParticipantGender {
    return value === "Male" || value === "Female" || value === "Other";
}

export type TemporaryParticipantInput = Partial<Omit<PersonalProfileData,
    "firstName" | "lastName" | "gender" | "dob" | "tel" | "email" | "ageYears" | "ageUpdatedDate"
>> & {
    firstName: string;
    lastName: string;
    gender: string;
    fsiiGenderDetail?: FsiiGenderDetail | null;
    dob: string;
    dobAgeOnly?: boolean | null;
    dobAge?: string | null;
    tel: string;
    email: string;
    wechatId?: string | null;
};

export type TemporaryParticipantData = PersonalProfileData & {
    id?: number;
    participantCode: string;
    legalName: string;
    wechatId: string | null;
    status: "active" | "disabled";
    convertedClientId: number | null;
    convertedClientCode: string | null;
    convertedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type TemporaryParticipantDataSource = PersonalProfileDataSource & {
    id?: number | null;
    participantCode?: string | null;
    legalName?: string | null;
    wechatId?: string | null;
    status?: "active" | "disabled" | null;
    convertedClientId?: number | null;
    convertedClientCode?: string | null;
    convertedAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type TemporaryParticipantAttendanceDto = {
    id: number;
    participantCode: string;
    legalName: string;
    gender: TemporaryParticipantGender | null;
    dob: string;
    tel: string;
    email: string;
    wechatId: string | null;
};

export function toTemporaryParticipantAttendanceDto(
    participant: TemporaryParticipantData & { id: number },
): TemporaryParticipantAttendanceDto {
    return {
        id: participant.id,
        participantCode: participant.participantCode,
        legalName: participant.legalName,
        gender: isTemporaryParticipantGender(participant.gender)
            ? participant.gender
            : participant.gender
                ? "Other"
                : null,
        dob: participant.dob,
        tel: participant.tel,
        email: participant.email,
        wechatId: participant.wechatId,
    };
}

export type TemporaryParticipantValidationIssue =
    | "first_name_required"
    | "last_name_required"
    | "legal_name_too_long"
    | "legal_name_invalid"
    | "gender_invalid"
    | "dob_invalid"
    | "dob_age_invalid"
    | "tel_required"
    | "tel_too_long"
    | "email_invalid"
    | "email_too_long"
    | "wechat_id_too_long"
    | "other_gender_invalid"
    | "grade_in_school_invalid"
    | "indigenous_identity_invalid"
    | "arrival_month_invalid"
    | "accessibility_difficulty_invalid"
    | "household_count_invalid"
    | "residential_status_invalid"
    | "postal_code_invalid";

function formText(formData: FormData, name: string): string {
    return formData.get(name)?.toString().trim() ?? "";
}

function formCheckbox(formData: FormData, name: string): boolean {
    return ["1", "true", "on", "yes"].includes(formText(formData, name).toLowerCase());
}

function formNonNegativeInteger(formData: FormData, name: string): number {
    const value = formText(formData, name);
    if (!value) return 0;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

export function createEmptyTemporaryParticipantData(): TemporaryParticipantData {
    return {
        ...createEmptyPersonalProfileData(),
        participantCode: "",
        legalName: "",
        wechatId: null,
        status: "active",
        convertedClientId: null,
        convertedClientCode: null,
        convertedAt: null,
        createdAt: "",
        updatedAt: "",
    };
}

export function normalizeTemporaryParticipantData(
    source?: TemporaryParticipantDataSource,
): TemporaryParticipantData {
    const profile = normalizePersonalProfileData(source);
    return {
        ...profile,
        id: source?.id ?? undefined,
        participantCode: source?.participantCode ?? "",
        legalName: formatTemporaryParticipantLegalName(
            profile.firstName,
            profile.lastName,
        ),
        wechatId: source?.wechatId ?? source?.wechatID ?? null,
        status: source?.status === "disabled" ? "disabled" : "active",
        convertedClientId: source?.convertedClientId ?? null,
        convertedClientCode: source?.convertedClientCode ?? null,
        convertedAt: source?.convertedAt ?? null,
        createdAt: source?.createdAt ?? "",
        updatedAt: source?.updatedAt ?? "",
    };
}

export function parseTemporaryParticipantFormData(formData: FormData): TemporaryParticipantInput {
    const rawGender = formText(formData, "gender");
    const normalizedGender = normalizeMemberGenderValue(rawGender);
    const displayedGender = normalizedGender || rawGender;
    const fsiiGenderDetail = displayedGender === "Transgender" || displayedGender === "Prefer not to disclose"
        ? displayedGender
        : null;
    return {
        firstName: formText(formData, "firstName"),
        lastName: formText(formData, "lastName"),
        legalNamePhotoIdVerified: formCheckbox(formData, "legalNamePhotoIdVerified"),
        englishName: formText(formData, "englishName"),
        chineseName: formText(formData, "chineseName"),
        gender: (fsiiGenderDetail ? "Other" : displayedGender) as TemporaryParticipantGender,
        fsiiGenderDetail,
        otherGender: formText(formData, "otherGender"),
        dob: formText(formData, "dob"),
        dobAgeOnly: formData.has(DOB_AGE_ONLY_FIELD),
        dobAge: formText(formData, DOB_AGE_FIELD),
        cob: formText(formData, "cob"),
        birthProvince: formText(formData, "birthProvince"),
        birthCity: formText(formData, "birthCity"),
        residentialStatus: formText(formData, "residentialStatus"),
        isVolunteer: formCheckbox(formData, "isVolunteer"),
        address: formText(formData, "address"),
        community: formText(formData, "community"),
        postalCode: normalizeCanadianPostalCode(formText(formData, "postalCode")),
        tel: formText(formData, "tel"),
        email: formText(formData, "email"),
        wechatID: formText(formData, "wechatID"),
        wechatId: formText(formData, "wechatID"),
        emergencyContactPerson: formText(formData, "emergencyContactPerson"),
        emergencyContactRelationship: formText(formData, "emergencyContactRelationship"),
        emergencyContactTel: formText(formData, "emergencyContactTel"),
        majorLanguage: formText(formData, "majorLanguage"),
        populationGroup: formText(formData, "populationGroup"),
        maritalStatus: formText(formData, "maritalStatus"),
        housingSituation: formText(formData, "housingSituation"),
        primaryIncome: formText(formData, "primaryIncome"),
        gradeInSchool: formText(formData, "gradeInSchool"),
        numberChild: formNonNegativeInteger(formData, "numberChild"),
        numberAdult: formNonNegativeInteger(formData, "numberAdult"),
        highestGrade: formText(formData, "highestGrade"),
        educationLevel: formText(formData, "educationLevel"),
        indigenousIdentity: formText(formData, "indigenousIdentity"),
        arrivalMonth: formText(formData, "arrivalMonth"),
        physicalAccessibilityDifficulty: formText(formData, "physicalAccessibilityDifficulty"),
        cognitiveDifficulty: formText(formData, "cognitiveDifficulty"),
        emotionalMentalHealthCondition: formText(formData, "emotionalMentalHealthCondition"),
        remark: formText(formData, "remark"),
    };
}

export function createTemporaryParticipantFormData(
    participant: TemporaryParticipantData,
    sourceFormData?: FormData,
): FormData {
    const formData = new FormData();
    sourceFormData?.forEach((value, key) => formData.append(key, value));
    Object.entries(participant).forEach(([key, value]) => {
        if ([
            "id",
            "participantCode",
            "legalName",
            "englishName",
            "wechatId",
            "status",
            "createdAt",
            "updatedAt",
            // Server-computed view state; the age round-trips through dobAge
            // when the age-only checkbox is submitted.
            "ageYears",
            "ageUpdatedDate",
        ].includes(key)) return;
        if (!formData.has(key) && value !== null && value !== undefined) {
            formData.append(key, String(value));
        }
    });
    formData.set("legalNamePhotoIdVerified", participant.legalNamePhotoIdVerified ? "on" : "");
    formData.set("isVolunteer", participant.isVolunteer ? "on" : "");
    formData.delete("website");
    formData.delete("contactPerson");
    return formData;
}

export function cleanTemporaryParticipantLegalName(value: string): string {
    return value.normalize("NFKC").trim().replace(/[ \t\n\v\f\r]+/g, " ");
}

export function formatTemporaryParticipantLegalName(
    firstName: string | null | undefined,
    lastName: string | null | undefined,
): string {
    return [firstName, lastName]
        .map((value) => cleanTemporaryParticipantLegalName(value ?? ""))
        .filter(Boolean)
        .join(" ");
}

export function normalizeTemporaryParticipantStructuredName(
    firstName: string | null | undefined,
    lastName: string | null | undefined,
): string {
    return normalizeTemporaryParticipantLegalName(
        formatTemporaryParticipantLegalName(firstName, lastName),
    );
}

export function normalizeTemporaryParticipantLegalName(value: string): string {
    return cleanTemporaryParticipantLegalName(value).toLocaleLowerCase("en-CA");
}

export function isValidTemporaryParticipantLegalName(value: string): boolean {
    const trimmed = value.trim();
    return (
        /[A-Za-z]/.test(trimmed) &&
        /^[A-Za-z '-]+$/.test(trimmed)
    );
}

export function isTemporaryParticipantDuplicateCandidate(
    legalName: string,
    dob: string,
    candidate: { legalName: string; dob: string },
): boolean {
    return (
        dob.trim() === candidate.dob.trim() &&
        normalizeTemporaryParticipantLegalName(legalName) ===
            normalizeTemporaryParticipantLegalName(candidate.legalName)
    );
}

export function formatTemporaryParticipantCode(id: number): string {
    if (!Number.isSafeInteger(id) || id < 1) {
        throw new RangeError("Temporary participant ID must be a positive safe integer.");
    }

    return `${TEMPORARY_PARTICIPANT_CODE_PREFIX}${String(id).padStart(4, "0")}`;
}

export function parseTemporaryParticipantCode(value: string): number | null {
    const match = value.trim().toUpperCase().match(/^TMP(\d{4}|[1-9]\d{4,})$/);
    if (!match) return null;

    const id = Number(match[1]);
    return Number.isSafeInteger(id) && id >= 1 ? id : null;
}

export function temporaryParticipantMaxDob(now = new Date()): string {
    return todayBusinessDate(now);
}

export function isValidTemporaryParticipantDob(value: string, now = new Date()): boolean {
    const normalized = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;

    const [yearText, monthText, dayText] = normalized.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        return false;
    }

    return (
        year >= TEMPORARY_PARTICIPANT_MIN_BIRTH_YEAR &&
        normalized <= temporaryParticipantMaxDob(now)
    );
}

export function validateTemporaryParticipantInput(
    input: TemporaryParticipantInput,
    now = new Date(),
    context: "public" | "admin" = "public",
): TemporaryParticipantValidationIssue | null {
    const firstName = cleanTemporaryParticipantLegalName(input.firstName);
    const lastName = cleanTemporaryParticipantLegalName(input.lastName);
    const legalName = formatTemporaryParticipantLegalName(firstName, lastName);
    if (!firstName) return "first_name_required";
    if (!lastName) return "last_name_required";
    if (legalName.length > TEMPORARY_PARTICIPANT_LEGAL_NAME_MAX_LENGTH) {
        return "legal_name_too_long";
    }
    if (
        !isValidTemporaryParticipantLegalName(input.firstName) ||
        !isValidTemporaryParticipantLegalName(input.lastName)
    ) {
        return "legal_name_invalid";
    }
    if (input.gender && !isTemporaryParticipantGender(input.gender)) {
        return "gender_invalid";
    }
    if (context === "public" && !isTemporaryParticipantGender(input.gender)) {
        return "gender_invalid";
    }
    if (input.fsiiGenderDetail && input.gender !== "Other") return "gender_invalid";
    if (input.dobAgeOnly) {
        // Age mode: the dob text is ignored server-side; only the age is validated.
        if (parseDobAgeYears(input.dobAge) === null) return "dob_age_invalid";
    } else if (!isValidTemporaryParticipantDob(input.dob, now)) {
        return "dob_invalid";
    }
    if (context === "public" && !input.tel.trim()) return "tel_required";
    if (input.tel.trim().length > TEMPORARY_PARTICIPANT_TEL_MAX_LENGTH) {
        return "tel_too_long";
    }
    if (input.email.trim().length > TEMPORARY_PARTICIPANT_EMAIL_MAX_LENGTH) {
        return "email_too_long";
    }
    if ((context === "public" || input.email.trim()) && !isValidEmail(input.email)) {
        return "email_invalid";
    }
    if (
        ((input.wechatId ?? input.wechatID)?.trim().length ?? 0) >
        TEMPORARY_PARTICIPANT_WECHAT_ID_MAX_LENGTH
    ) {
        return "wechat_id_too_long";
    }
    if (input.residentialStatus && !isResidentialStatus(input.residentialStatus)) {
        return "residential_status_invalid";
    }
    if (!isValidCanadianPostalCode(input.postalCode)) {
        return "postal_code_invalid";
    }
    if (
        input.gender === "Other" && !input.fsiiGenderDetail &&
        (input.otherGender?.trim().length ?? 0) > FSII_OTHER_GENDER_MAX_LENGTH
    ) {
        return "other_gender_invalid";
    }
    if (input.gradeInSchool && !isGradeInSchool(input.gradeInSchool)) {
        return "grade_in_school_invalid";
    }
    if (input.indigenousIdentity && !isFsiiIndigenousIdentity(input.indigenousIdentity)) {
        return "indigenous_identity_invalid";
    }
    if (input.arrivalMonth && !isIsoCalendarMonth(input.arrivalMonth)) {
        return "arrival_month_invalid";
    }
    for (const value of [
        input.physicalAccessibilityDifficulty,
        input.cognitiveDifficulty,
        input.emotionalMentalHealthCondition,
    ]) {
        if (value && !isFsiiAccessibilityDifficulty(value)) {
            return "accessibility_difficulty_invalid";
        }
    }
    if (
        (input.numberChild !== undefined && (!Number.isInteger(input.numberChild) || input.numberChild < 0)) ||
        (input.numberAdult !== undefined && (!Number.isInteger(input.numberAdult) || input.numberAdult < 0))
    ) {
        return "household_count_invalid";
    }

    return null;
}
