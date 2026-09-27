import {
    isTemporaryParticipantGender,
    isValidTemporaryParticipantLegalName,
    isValidTemporaryParticipantDob,
    TEMPORARY_PARTICIPANT_EMAIL_MAX_LENGTH,
    TEMPORARY_PARTICIPANT_LEGAL_NAME_MAX_LENGTH,
    TEMPORARY_PARTICIPANT_TEL_MAX_LENGTH,
    type TemporaryParticipantGender,
} from "./temporary-participant.ts";
import { maskPhone } from "./sensitive-field.ts";

export { maskPhone };

export const ACTIVITY_REGISTRATION_CODE_PATTERN =
    /^(?:SCSC|R|TMP)(?:\d{4}|[1-9]\d{4,})$/i;
export const ACTIVITY_REGISTRATION_NAME_MAX_LENGTH =
    TEMPORARY_PARTICIPANT_LEGAL_NAME_MAX_LENGTH;
export const ACTIVITY_REGISTRATION_OUTCOME_RECOVERY_FIELD = "registrationOutcome";

export function equalsAsciiCaseInsensitive(left: string, right: string): boolean {
    const foldAscii = (value: string) => value.replace(/[A-Z]/g, (character) =>
        String.fromCharCode(character.charCodeAt(0) + 32));
    return foldAscii(left) === foldAscii(right);
}

export type ActivityRegistrationMode = "member" | "nonmember";
export type ActivityRegistrationStatus =
    | "registered"
    | "not_registered"
    | "unknown"
    | "loading"
    | "error";
export type ActivityRegistrationStatusErrorCode =
    | "status_unavailable"
    | "update_conflict";
export type ActivityRegistrationStatusResult =
    | { status: Exclude<ActivityRegistrationStatus, "error"> }
    | { status: "error"; error: ActivityRegistrationStatusErrorCode };
export type ActivityRegistrationMemberOutcome =
    | "match"
    | "different_people"
    | "name_only"
    | "code_only"
    | "not_found"
    | "ambiguous";
export type ActivityRegistrationDobOutcome =
    | "match"
    | "dob_mismatch"
    | "name_not_found"
    | "ambiguous";
export type ActivityRegistrationLookupOutcome =
    | ActivityRegistrationMemberOutcome
    | ActivityRegistrationDobOutcome;
export type ActivityRegistrationLookupRecovery =
    | "none"
    | "try_member_code"
    | "complete_nonmember_details"
    | "contact_scsc";

export type ActivityRegistrationContact = {
    gender: TemporaryParticipantGender | null;
    tel: string | null;
    email: string | null;
};

export type ActivityRegistrationManualInput = {
    gender: string;
    tel: string;
    email: string;
};

export type ActivityRegistrationValidationIssue =
    | "name_required"
    | "name_too_long"
    | "name_invalid"
    | "code_or_dob_required"
    | "code_invalid"
    | "dob_invalid"
    | "gender_required"
    | "gender_invalid"
    | "tel_required"
    | "tel_too_long"
    | "email_required"
    | "email_invalid"
    | "email_too_long";

export function normalizeActivityRegistrationText(value: string): string {
    return value.trim();
}

export function normalizeActivityRegistrationCode(value: string): string {
    return normalizeActivityRegistrationText(value).toUpperCase();
}

export function isActivityRegistrationCode(value: string): boolean {
    return ACTIVITY_REGISTRATION_CODE_PATTERN.test(normalizeActivityRegistrationCode(value));
}

export function activityRegistrationLookupRecovery(
    mode: ActivityRegistrationMode,
    outcome: ActivityRegistrationLookupOutcome,
): ActivityRegistrationLookupRecovery {
    if (outcome === "dob_mismatch" || outcome === "name_not_found") {
        return mode === "member" ? "try_member_code" : "complete_nonmember_details";
    }
    if (outcome === "ambiguous") {
        return mode === "member" ? "try_member_code" : "contact_scsc";
    }
    return "none";
}

export function readActivityRegistrationOutcomeRecovery(
    formData: FormData,
    mode: ActivityRegistrationMode,
): ActivityRegistrationLookupOutcome | null {
    const values = formData.getAll(ACTIVITY_REGISTRATION_OUTCOME_RECOVERY_FIELD);
    if (values.length !== 1 || typeof values[0] !== "string") return null;
    const value = values[0];

    if (mode === "member") {
        if (
            value === "match" ||
            value === "different_people" ||
            value === "name_only" ||
            value === "code_only" ||
            value === "not_found" ||
            value === "ambiguous"
        ) {
            return value;
        }
        return null;
    }

    if (
        value === "match" ||
        value === "dob_mismatch" ||
        value === "name_not_found" ||
        value === "ambiguous"
    ) {
        return value;
    }
    return null;
}

export function canSubmitActivityRegistration(input: {
    activitySelected: boolean;
    identityMatched: boolean;
    manualNonMemberReady: boolean;
    questionnaireReady: boolean;
    turnstileReady: boolean;
}): boolean {
    return input.activitySelected &&
        (input.identityMatched || input.manualNonMemberReady) &&
        input.questionnaireReady &&
        input.turnstileReady;
}

export function turnstileClientErrorRequiresExternalBrowser(code: unknown): boolean {
    return typeof code === "string" && /^(?:300|600)\d*$/.test(code);
}

export function validateActivityRegistrationLookup(input: {
    mode: ActivityRegistrationMode;
    name: string;
    memberCode: string;
    dob: string;
}): ActivityRegistrationValidationIssue | null {
    const name = normalizeActivityRegistrationText(input.name);
    const memberCode = normalizeActivityRegistrationCode(input.memberCode);
    const dob = normalizeActivityRegistrationText(input.dob);

    if (!name) return "name_required";
    if (name.length > ACTIVITY_REGISTRATION_NAME_MAX_LENGTH) return "name_too_long";

    if (input.mode === "nonmember") {
        if (!isValidTemporaryParticipantLegalName(input.name)) {
            return "name_invalid";
        }
        return isValidTemporaryParticipantDob(dob) ? null : "dob_invalid";
    }

    if (!memberCode && !dob) return "code_or_dob_required";
    if (memberCode) return isActivityRegistrationCode(memberCode) ? null : "code_invalid";
    return isValidTemporaryParticipantDob(dob) ? null : "dob_invalid";
}

export function validateActivityRegistrationManualInput(
    input: ActivityRegistrationManualInput,
): ActivityRegistrationValidationIssue | null {
    if (!input.gender) return "gender_required";
    if (!isTemporaryParticipantGender(input.gender)) return "gender_invalid";
    if (!input.tel.trim()) return "tel_required";
    if (input.tel.trim().length > TEMPORARY_PARTICIPANT_TEL_MAX_LENGTH) {
        return "tel_too_long";
    }
    if (!input.email.trim()) return "email_required";
    if (input.email.trim().length > TEMPORARY_PARTICIPANT_EMAIL_MAX_LENGTH) {
        return "email_too_long";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
        return "email_invalid";
    }
    return null;
}

export function isActivityRegistrationContactComplete(
    contact: ActivityRegistrationContact | null | undefined,
): boolean {
    return Boolean(contact) && validateActivityRegistrationManualInput({
        gender: contact?.gender ?? "",
        tel: contact?.tel ?? "",
        email: contact?.email ?? "",
    }) === null;
}

export function maskEmail(value: string | null | undefined): string | null {
    const normalized = value?.trim() ?? "";
    if (!normalized) return null;
    const at = normalized.indexOf("@");
    if (at <= 0 || at === normalized.length - 1) return "••••";
    const local = normalized.slice(0, at);
    const domain = normalized.slice(at + 1);
    return `${local.length > 1 ? local.slice(0, 1) : ""}•••@${domain}`;
}

export function maskActivityRegistrationContact(
    contact: ActivityRegistrationContact,
): ActivityRegistrationContact {
    return {
        gender: contact.gender,
        tel: maskPhone(contact.tel),
        email: maskEmail(contact.email),
    };
}
