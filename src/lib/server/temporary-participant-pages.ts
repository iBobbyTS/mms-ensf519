import {
    resolveClientDirectoryPageSize,
} from "$lib/client-directory";
import { error, fail, redirect, type Cookies } from "@sveltejs/kit";
import * as m from "$lib/paraglide/messages";
import {
    resolveTemporaryParticipantDirectorySort,
    type TemporaryParticipantDirectorySort,
} from "$lib/temporary-participant-directory";
import { getDb } from "$lib/server/db";
import { setPageFlash } from "$lib/server/page-flash";
import {
    createManualFsiiSurveyResponses,
    listFsiiSurveyResponses,
} from "$lib/server/fsii-survey-responses";
import { requireAdminAccess } from "$lib/server/security";
import {
    createTemporaryParticipant,
    getTemporaryParticipantById,
    listTemporaryParticipants,
    type TemporaryParticipantRecord,
    TemporaryParticipantDuplicateError,
    TemporaryParticipantValidationError,
    updateTemporaryParticipant,
} from "$lib/server/temporary-participants";
import {
    DOB_AGE_ONLY_MAX,
    DOB_AGE_ONLY_MIN,
    parseTemporaryParticipantCode,
    parseTemporaryParticipantFormData,
    TEMPORARY_PARTICIPANT_EMAIL_MAX_LENGTH,
    TEMPORARY_PARTICIPANT_LEGAL_NAME_MAX_LENGTH,
    TEMPORARY_PARTICIPANT_MIN_BIRTH_YEAR,
    TEMPORARY_PARTICIPANT_TEL_MAX_LENGTH,
    TEMPORARY_PARTICIPANT_WECHAT_ID_MAX_LENGTH,
    temporaryParticipantMaxDob,
    type TemporaryParticipantValidationIssue,
} from "$lib/temporary-participant";

export function temporaryParticipantValidationMessage(
    issue: TemporaryParticipantValidationIssue,
): string {
    switch (issue) {
        case "first_name_required": return m.temporaryParticipantFirstNameRequired();
        case "last_name_required": return m.temporaryParticipantLastNameRequired();
        case "legal_name_too_long": return m.temporaryParticipantLegalNameTooLong({ max: TEMPORARY_PARTICIPANT_LEGAL_NAME_MAX_LENGTH });
        case "legal_name_invalid": return m.temporaryParticipantLegalNameInvalid();
        case "gender_invalid": return m.genderInvalid();
        case "dob_invalid": return m.temporaryParticipantDobInvalid({ min: `${TEMPORARY_PARTICIPANT_MIN_BIRTH_YEAR}-01-01`, max: temporaryParticipantMaxDob() });
        case "dob_age_invalid": return m.temporaryParticipantDobAgeInvalid({ min: DOB_AGE_ONLY_MIN, max: DOB_AGE_ONLY_MAX });
        case "tel_required": return m.temporaryParticipantTelRequired();
        case "tel_too_long": return m.temporaryParticipantTelTooLong({ max: TEMPORARY_PARTICIPANT_TEL_MAX_LENGTH });
        case "email_invalid": return m.temporaryParticipantEmailInvalid();
        case "email_too_long": return m.temporaryParticipantEmailTooLong({ max: TEMPORARY_PARTICIPANT_EMAIL_MAX_LENGTH });
        case "wechat_id_too_long": return m.temporaryParticipantWechatIdTooLong({ max: TEMPORARY_PARTICIPANT_WECHAT_ID_MAX_LENGTH });
        case "other_gender_invalid": return m.otherGenderInvalid();
        case "grade_in_school_invalid": return m.gradeInSchoolInvalid();
        case "indigenous_identity_invalid": return m.indigenousIdentityInvalid();
        case "arrival_month_invalid": return m.arrivalMonthInvalid();
        case "accessibility_difficulty_invalid": return m.accessibilityDifficultyInvalid();
        case "residential_status_invalid": return m.residentialStatusInvalid();
        case "household_count_invalid": return m.temporaryParticipantHouseholdCountInvalid();
        case "postal_code_invalid": return m.postalCodeInvalid();
    }
}

export async function loadTemporaryParticipantDirectoryPage(
    platform: App.Platform | undefined,
    query?: {
        search: string;
        page: number;
        limit: number;
        sort: TemporaryParticipantDirectorySort;
    },
) {
    const page = Math.max(query?.page ?? 1, 1);
    const search = query?.search ?? "";
    const limit = query?.limit ?? resolveClientDirectoryPageSize();
    const sort = query?.sort ?? resolveTemporaryParticipantDirectorySort({ sort: null, dir: null });

    const { rows, total } = await listTemporaryParticipants(getDb(platform), {
        page,
        limit,
        search,
        sort,
    });

    return { participants: rows, total, page, limit, search, sort };
}

function resolveTemporaryParticipantId(value: string): number | null {
    const fromCode = parseTemporaryParticipantCode(value);
    if (fromCode !== null) return fromCode;
    if (!/^[1-9][0-9]*$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}

export async function loadTemporaryParticipantDetailPage(
    params: { id: string },
    platform: App.Platform | undefined,
) {
    const participantId = resolveTemporaryParticipantId(params.id);
    if (participantId === null) throw error(404, m.temporaryParticipantNotFound());
    const participant = await getTemporaryParticipantById(getDb(platform), participantId);
    if (!participant) throw error(404, m.temporaryParticipantNotFound());
    const fsiiSurveyResponses = await listFsiiSurveyResponses(getDb(platform), { clientCode: participant.participantCode });
    return { participant, fsiiSurveyResponses };
}

type TemporaryParticipantActionContext = {
    request: Request;
    locals: App.Locals;
    platform: App.Platform | undefined;
    cookies: Cookies;
    url: URL;
    params?: { id?: string };
};

function participantActionFailure(cause: unknown) {
    if (cause instanceof TemporaryParticipantValidationError) {
        return fail(400, { error: temporaryParticipantValidationMessage(cause.issue) });
    }
    if (cause instanceof TemporaryParticipantDuplicateError) {
        return fail(409, {
            error: m.temporaryParticipantDuplicate({ code: cause.participant.participantCode }),
        });
    }
    return null;
}

export const createTemporaryParticipantActions = {
    default: async (context: TemporaryParticipantActionContext) => {
        requireAdminAccess(context.locals);
        let participant: TemporaryParticipantRecord;
        try {
            participant = await createTemporaryParticipant(
                getDb(context.platform),
                parseTemporaryParticipantFormData(await context.request.formData()),
                "admin",
            );
        } catch (cause) {
            if (cause instanceof Response) throw cause;
            const failure = participantActionFailure(cause);
            if (failure) return failure;
            console.error("Temporary participant creation failed", cause);
            return fail(500, { error: m.temporaryParticipantSaveFailed() });
        }
        const detailPath = `/temporary-participants/${participant.participantCode}`;
        setPageFlash(context.cookies, {
            path: detailPath,
            value: "created",
            secure: context.url.protocol === "https:",
        });
        throw redirect(303, detailPath);
    },
};

export const updateTemporaryParticipantActions = {
    addSurvey: async (context: TemporaryParticipantActionContext) => {
        requireAdminAccess(context.locals);
        const participantId = resolveTemporaryParticipantId(context.params?.id ?? "");
        if (participantId === null) return fail(404, { fsiiSurveyError: "unknown_client_code" });
        const participant = await getTemporaryParticipantById(getDb(context.platform), participantId);
        if (!participant) return fail(404, { fsiiSurveyError: "unknown_client_code" });
        const form = await context.request.formData();
        const result = await createManualFsiiSurveyResponses(getDb(context.platform), {
            clientCode: participant.participantCode,
            form,
            createdBy: null,
        });
        if (result) return fail(result === "write_failed" ? 500 : 400, { fsiiSurveyError: result });
        return { surveyAdded: true };
    },
    update: async (context: TemporaryParticipantActionContext) => {
        requireAdminAccess(context.locals);
        const participantId = resolveTemporaryParticipantId(context.params?.id ?? "");
        if (participantId === null) return fail(404, { error: m.temporaryParticipantNotFound() });
        let participant: TemporaryParticipantRecord;
        try {
            const updatedParticipant = await updateTemporaryParticipant(
                getDb(context.platform),
                participantId,
                parseTemporaryParticipantFormData(await context.request.formData()),
                "admin",
            );
            if (!updatedParticipant) return fail(404, { error: m.temporaryParticipantNotFound() });
            participant = updatedParticipant;
        } catch (cause) {
            if (cause instanceof Response) throw cause;
            const failure = participantActionFailure(cause);
            if (failure) return failure;
            console.error("Temporary participant update failed", cause);
            return fail(500, { error: m.temporaryParticipantSaveFailed() });
        }
        const detailPath = `/temporary-participants/${participant.participantCode}`;
        setPageFlash(context.cookies, {
            path: detailPath,
            value: "updated",
            secure: context.url.protocol === "https:",
        });
        throw redirect(303, detailPath);
    },
};
