export const ACTIVITY_QUESTION_MAX_COUNT = 20;
export const ACTIVITY_QUESTION_TITLE_MAX_LENGTH = 200;
export const ACTIVITY_QUESTION_OPTION_MAX_COUNT = 20;
export const ACTIVITY_QUESTION_OPTION_MAX_LENGTH = 100;
export const ACTIVITY_QUESTION_STRING_ANSWER_MAX_LENGTH = 4000;
export const ACTIVITY_AI_QUESTION_ID_MAX_LENGTH = 100;
export const ACTIVITY_AI_QUESTION_TEMPLATE_MAX_LENGTH = 8000;
export const ACTIVITY_AI_CURRENT_ANSWER_TOKEN = "{本回答}";
export const ACTIVITY_AI_OTHER_ANSWERS_TOKEN = "{其他回答}";
export const ACTIVITY_AI_OUTPUT_TOKEN = "{输出}";
export const ACTIVITY_QUESTIONNAIRE_MAX_BYTES = 64 * 1024;
export const ACTIVITY_QUESTIONNAIRE_VERSION_FIELD = "questionnaireVersion";
export const ACTIVITY_QUESTIONNAIRE_SNAPSHOT_FIELD = "questionnaireSnapshot";

const ACTIVITY_QUESTIONNAIRE_VERSION_PREFIX = "v1-";

export type ActivityBoolQuestion = {
    title: string;
    type: "bool";
    params: null;
    required: boolean;
};

export type ActivityStringQuestion = {
    title: string;
    type: "string";
    params: { multiline: boolean };
    required: boolean;
};

export type ActivityMultipleQuestion = {
    title: string;
    type: "multiple";
    params: { options: string[] };
    required: boolean;
};

export type ActivityAiQuestion = {
    id: string;
    title: string;
    type: "ai";
    params: {
        prompt: string;
        threshold: number;
        confirmationText: string;
        includeOtherAnswers: boolean;
    };
    required: boolean;
};

export type ActivityQuestion =
    | ActivityBoolQuestion
    | ActivityStringQuestion
    | ActivityAiQuestion
    | ActivityMultipleQuestion;

export type ActivityQuestionnaire = {
    questions: ActivityQuestion[];
};

export type ActivityAnswerValue = boolean | string | string[] | null;

/** Values used to hydrate an answer form before the user has completed it. */
export function emptyActivityAnswerValues(
    questionnaire: ActivityQuestionnaire,
): ActivityAnswerValue[] {
    return questionnaire.questions.map((question) =>
        question.type === "multiple" ? [] : null
    );
}

export type ActivityRegistrationAnswer =
    | { title: string; type: "bool"; value: boolean | null }
    | { title: string; type: "string"; value: string | null }
    | { title: string; type: "ai"; value: string | null }
    | { title: string; type: "multiple"; value: string[] };

export type ActivityRegistrationAnswers = {
    answers: ActivityRegistrationAnswer[];
};

export type ActivityQuestionnaireIssueCode =
    | "invalid_json"
    | "invalid_shape"
    | "too_large"
    | "too_many_questions"
    | "title_required"
    | "title_too_long"
    | "invalid_params"
    | "too_few_options"
    | "too_many_options"
    | "option_required"
    | "option_too_long"
    | "duplicate_option";

export type ActivityQuestionnaireIssue = {
    code: ActivityQuestionnaireIssueCode;
    questionIndex?: number;
    optionIndex?: number;
};

export type ActivityAnswerIssueCode =
    | "invalid_payload"
    | "required"
    | "invalid_value"
    | "answer_too_long"
    | "unknown_option"
    | "duplicate_selection"
    | "too_large";

export type ActivityAnswerIssue = {
    code: ActivityAnswerIssueCode;
    questionIndex?: number;
};

export type ActivityQuestionnaireResult =
    | { ok: true; value: ActivityQuestionnaire }
    | { ok: false; issue: ActivityQuestionnaireIssue };

export type ActivityAnswersResult =
    | {
        ok: true;
        values: ActivityAnswerValue[];
        value: ActivityRegistrationAnswers;
    }
    | {
        ok: false;
        values: ActivityAnswerValue[];
        issue: ActivityAnswerIssue;
    };

export type ActivityQuestionnaireRecovery = {
    questionnaire: ActivityQuestionnaire;
    questionnaireVersion: string;
    answerValues: ActivityAnswerValue[];
};

export const EMPTY_ACTIVITY_QUESTIONNAIRE: ActivityQuestionnaire = { questions: [] };
export const EMPTY_ACTIVITY_REGISTRATION_ANSWERS: ActivityRegistrationAnswers = {
    answers: [],
};

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length &&
        actual.every((key, index) => key === expected[index]);
}

function jsonByteLength(value: unknown): number {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export async function activityQuestionnaireVersion(
    questionnaire: ActivityQuestionnaire,
): Promise<string> {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(questionnaire)),
    );
    const hex = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("");
    return `${ACTIVITY_QUESTIONNAIRE_VERSION_PREFIX}${hex}`;
}

function invalidQuestionnaire(
    code: ActivityQuestionnaireIssueCode,
    questionIndex?: number,
    optionIndex?: number,
): ActivityQuestionnaireResult {
    return {
        ok: false,
        issue: { code, questionIndex, optionIndex },
    };
}

export function validateActivityQuestionnaire(value: unknown): ActivityQuestionnaireResult {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return invalidQuestionnaire("invalid_shape");
    }
    const candidate = value as Record<string, unknown>;
    if (!hasExactKeys(candidate, ["questions"]) || !Array.isArray(candidate.questions)) {
        return invalidQuestionnaire("invalid_shape");
    }
    if (candidate.questions.length > ACTIVITY_QUESTION_MAX_COUNT) {
        return invalidQuestionnaire("too_many_questions");
    }

    const questions: ActivityQuestion[] = [];
    const aiQuestionIds = new Set<string>();
    for (let questionIndex = 0; questionIndex < candidate.questions.length; questionIndex += 1) {
        const rawQuestion = candidate.questions[questionIndex];
        if (!rawQuestion || typeof rawQuestion !== "object" || Array.isArray(rawQuestion)) {
            return invalidQuestionnaire("invalid_shape", questionIndex);
        }
        const question = rawQuestion as Record<string, unknown>;
        if (
            !hasExactKeys(question, question.type === "ai" ? ["id", "title", "type", "params", "required"] : ["title", "type", "params", "required"]) ||
            typeof question.title !== "string" ||
            typeof question.type !== "string" ||
            typeof question.required !== "boolean"
        ) {
            return invalidQuestionnaire("invalid_shape", questionIndex);
        }
        const title = question.title.trim();
        if (!title) return invalidQuestionnaire("title_required", questionIndex);
        if (title.length > ACTIVITY_QUESTION_TITLE_MAX_LENGTH) {
            return invalidQuestionnaire("title_too_long", questionIndex);
        }

        if (question.type === "bool") {
            if (question.params !== null) {
                return invalidQuestionnaire("invalid_params", questionIndex);
            }
            questions.push({
                title,
                type: "bool",
                params: null,
                required: question.required,
            });
            continue;
        }

        if (question.type === "string") {
            if (
                !question.params ||
                typeof question.params !== "object" ||
                Array.isArray(question.params) ||
                !hasExactKeys(question.params as Record<string, unknown>, ["multiline"]) ||
                typeof (question.params as Record<string, unknown>).multiline !== "boolean"
            ) {
                return invalidQuestionnaire("invalid_params", questionIndex);
            }
            questions.push({
                title,
                type: "string",
                params: {
                    multiline: (question.params as { multiline: boolean }).multiline,
                },
                required: question.required,
            });
            continue;
        }

        if (question.type === "ai") {
            const params = question.params as Record<string, unknown> | null;
            if (
                typeof question.id !== "string" || !question.id.trim() || question.id.trim() !== question.id ||
                question.id.length > ACTIVITY_AI_QUESTION_ID_MAX_LENGTH ||
                !params || Array.isArray(params) ||
                !hasExactKeys(params, ["prompt", "threshold", "confirmationText", "includeOtherAnswers"]) ||
                typeof params.prompt !== "string" || params.prompt.length > ACTIVITY_AI_QUESTION_TEMPLATE_MAX_LENGTH ||
                !params.prompt.includes(ACTIVITY_AI_CURRENT_ANSWER_TOKEN) ||
                typeof params.confirmationText !== "string" || params.confirmationText.length > ACTIVITY_AI_QUESTION_TEMPLATE_MAX_LENGTH ||
                !params.confirmationText.includes(ACTIVITY_AI_OUTPUT_TOKEN) ||
                typeof params.includeOtherAnswers !== "boolean" ||
                (params.includeOtherAnswers !== params.prompt.includes(ACTIVITY_AI_OTHER_ANSWERS_TOKEN)) ||
                typeof params.threshold !== "number" || !Number.isFinite(params.threshold) || !Number.isInteger(params.threshold) || params.threshold <= 0
            ) return invalidQuestionnaire("invalid_params", questionIndex);
            if (aiQuestionIds.has(question.id)) return invalidQuestionnaire("invalid_params", questionIndex);
            aiQuestionIds.add(question.id);
            questions.push({
                id: question.id,
                title,
                type: "ai",
                params: {
                    prompt: params.prompt,
                    threshold: params.threshold,
                    confirmationText: params.confirmationText,
                    includeOtherAnswers: params.includeOtherAnswers,
                },
                required: question.required,
            });
            continue;
        }

        if (question.type !== "multiple") {
            return invalidQuestionnaire("invalid_shape", questionIndex);
        }
        if (
            !question.params ||
            typeof question.params !== "object" ||
            Array.isArray(question.params) ||
            !hasExactKeys(question.params as Record<string, unknown>, ["options"]) ||
            !Array.isArray((question.params as Record<string, unknown>).options)
        ) {
            return invalidQuestionnaire("invalid_params", questionIndex);
        }
        const rawOptions = (question.params as { options: unknown[] }).options;
        if (rawOptions.length < 2) {
            return invalidQuestionnaire("too_few_options", questionIndex);
        }
        if (rawOptions.length > ACTIVITY_QUESTION_OPTION_MAX_COUNT) {
            return invalidQuestionnaire("too_many_options", questionIndex);
        }
        const options: string[] = [];
        for (let optionIndex = 0; optionIndex < rawOptions.length; optionIndex += 1) {
            const rawOption = rawOptions[optionIndex];
            if (typeof rawOption !== "string" || !rawOption.trim()) {
                return invalidQuestionnaire("option_required", questionIndex, optionIndex);
            }
            const option = rawOption.trim();
            if (option.length > ACTIVITY_QUESTION_OPTION_MAX_LENGTH) {
                return invalidQuestionnaire("option_too_long", questionIndex, optionIndex);
            }
            if (options.includes(option)) {
                return invalidQuestionnaire("duplicate_option", questionIndex, optionIndex);
            }
            options.push(option);
        }
        questions.push({
            title,
            type: "multiple",
            params: { options },
            required: question.required,
        });
    }

    const normalized = { questions };
    if (jsonByteLength(normalized) > ACTIVITY_QUESTIONNAIRE_MAX_BYTES) {
        return invalidQuestionnaire("too_large");
    }
    return { ok: true, value: normalized };
}

export function parseActivityQuestionnaireJson(value: string): ActivityQuestionnaireResult {
    if (new TextEncoder().encode(value).byteLength > ACTIVITY_QUESTIONNAIRE_MAX_BYTES) {
        return invalidQuestionnaire("too_large");
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        return invalidQuestionnaire("invalid_json");
    }
    return validateActivityQuestionnaire(parsed);
}

export function activityQuestionFieldName(questionIndex: number): string {
    return `question-${questionIndex}`;
}

function emptyValues(questionnaire: ActivityQuestionnaire): ActivityAnswerValue[] {
    return emptyActivityAnswerValues(questionnaire);
}

function invalidAnswers(
    values: ActivityAnswerValue[],
    code: ActivityAnswerIssueCode,
    questionIndex?: number,
): ActivityAnswersResult {
    return { ok: false, values, issue: { code, questionIndex } };
}

export function validateActivityAnswerValues(
    questionnaire: ActivityQuestionnaire,
    inputValues: readonly unknown[],
): ActivityAnswersResult {
    const values = emptyValues(questionnaire);
    const answers: ActivityRegistrationAnswer[] = [];
    let firstIssue: ActivityAnswerIssue | null = null;

    for (let questionIndex = 0; questionIndex < questionnaire.questions.length; questionIndex += 1) {
        const question = questionnaire.questions[questionIndex];
        const input = inputValues[questionIndex];

        if (question.type === "bool") {
            const value = input === true || input === false ? input : null;
            values[questionIndex] = value;
            if (input !== null && input !== undefined && input !== "" && value === null) {
                firstIssue ??= { code: "invalid_value", questionIndex };
                continue;
            }
            if (question.required && value === null) {
                firstIssue ??= { code: "required", questionIndex };
                continue;
            }
            answers.push({ title: question.title, type: question.type, value });
            continue;
        }

        if (question.type === "string" || question.type === "ai") {
            if (input !== null && input !== undefined && typeof input !== "string") {
                firstIssue ??= { code: "invalid_value", questionIndex };
                continue;
            }
            const rawValue = typeof input === "string" ? input : "";
            if (rawValue.length > ACTIVITY_QUESTION_STRING_ANSWER_MAX_LENGTH) {
                firstIssue ??= { code: "answer_too_long", questionIndex };
                continue;
            }
            const value = rawValue.trim();
            values[questionIndex] = value || null;
            if (question.required && !value) {
                firstIssue ??= { code: "required", questionIndex };
                continue;
            }
            answers.push({
                title: question.title,
                type: question.type,
                value: value || null,
            });
            continue;
        }

        const multipleInput = input === null || input === undefined ? [] : input;
        if (!Array.isArray(multipleInput) || multipleInput.some((item) => typeof item !== "string")) {
            firstIssue ??= { code: "invalid_value", questionIndex };
            continue;
        }
        const selected = multipleInput as string[];
        if (new Set(selected).size !== selected.length) {
            firstIssue ??= { code: "duplicate_selection", questionIndex };
            continue;
        }
        if (selected.some((option) => !question.params.options.includes(option))) {
            firstIssue ??= { code: "unknown_option", questionIndex };
            continue;
        }
        const normalized = question.params.options.filter((option) => selected.includes(option));
        values[questionIndex] = normalized;
        if (question.required && normalized.length === 0) {
            firstIssue ??= { code: "required", questionIndex };
            continue;
        }
        answers.push({ title: question.title, type: question.type, value: normalized });
    }

    if (firstIssue) {
        return invalidAnswers(values, firstIssue.code, firstIssue.questionIndex);
    }

    const value = { answers };
    if (jsonByteLength(value) > ACTIVITY_QUESTIONNAIRE_MAX_BYTES) {
        return invalidAnswers(values, "too_large");
    }
    return { ok: true, values, value };
}

export function readActivityAnswerFormData(
    formData: FormData,
    questionnaire: ActivityQuestionnaire,
): ActivityAnswersResult {
    const values = emptyValues(questionnaire);
    let firstPayloadIssue: ActivityAnswerIssue | null = null;

    for (const key of new Set(formData.keys())) {
        if (!key.startsWith("question-")) continue;
        const match = key.match(/^question-(\d+)$/);
        const questionIndex = match ? Number(match[1]) : Number.NaN;
        if (
            !Number.isInteger(questionIndex) ||
            questionIndex < 0 ||
            questionIndex >= questionnaire.questions.length
        ) {
            firstPayloadIssue ??= { code: "invalid_payload" };
        }
    }

    for (let questionIndex = 0; questionIndex < questionnaire.questions.length; questionIndex += 1) {
        const question = questionnaire.questions[questionIndex];
        const submitted = formData.getAll(activityQuestionFieldName(questionIndex));
        if (submitted.some((value) => typeof value !== "string")) {
            firstPayloadIssue ??= { code: "invalid_payload", questionIndex };
            continue;
        }
        const stringValues = submitted as string[];
        if (question.type === "multiple") {
            values[questionIndex] = stringValues;
            continue;
        }
        if (stringValues.length > 1) {
            firstPayloadIssue ??= { code: "invalid_payload", questionIndex };
            continue;
        }
        const raw = stringValues[0];
        if (question.type === "bool") {
            values[questionIndex] = raw === "true"
                ? true
                : raw === "false"
                  ? false
                  : raw === undefined
                    ? null
                    : raw;
        } else {
            values[questionIndex] = raw === undefined ? "" : raw;
        }
    }
    const result = validateActivityAnswerValues(questionnaire, values);
    if (firstPayloadIssue) {
        return invalidAnswers(result.values, firstPayloadIssue.code, firstPayloadIssue.questionIndex);
    }
    return result;
}

export async function readActivityQuestionnaireRecoveryFormData(
    formData: FormData,
): Promise<ActivityQuestionnaireRecovery | null> {
    const snapshots = formData.getAll(ACTIVITY_QUESTIONNAIRE_SNAPSHOT_FIELD);
    const versions = formData.getAll(ACTIVITY_QUESTIONNAIRE_VERSION_FIELD);
    if (
        snapshots.length !== 1 ||
        versions.length !== 1 ||
        typeof snapshots[0] !== "string" ||
        typeof versions[0] !== "string"
    ) {
        return null;
    }

    const questionnaireResult = parseActivityQuestionnaireJson(snapshots[0]);
    if (!questionnaireResult.ok) return null;
    const questionnaireVersion = await activityQuestionnaireVersion(questionnaireResult.value);
    if (versions[0] !== questionnaireVersion) return null;

    const answerResult = readActivityAnswerFormData(formData, questionnaireResult.value);
    if (jsonByteLength(answerResult.values) > ACTIVITY_QUESTIONNAIRE_MAX_BYTES) return null;
    return {
        questionnaire: questionnaireResult.value,
        questionnaireVersion,
        answerValues: answerResult.values,
    };
}

export function parseStoredActivityRegistrationAnswers(
    value: unknown,
    questionnaire?: ActivityQuestionnaire,
): ActivityRegistrationAnswers | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const candidate = value as Record<string, unknown>;
    if (!hasExactKeys(candidate, ["answers"]) || !Array.isArray(candidate.answers)) return null;
    if (candidate.answers.length > ACTIVITY_QUESTION_MAX_COUNT) return null;
    if (questionnaire && candidate.answers.length !== questionnaire.questions.length) return null;

    const answers: ActivityRegistrationAnswer[] = [];
    for (let index = 0; index < candidate.answers.length; index += 1) {
        const answer = candidate.answers[index];
        if (!answer || typeof answer !== "object" || Array.isArray(answer)) return null;
        const item = answer as Record<string, unknown>;
        if (
            !hasExactKeys(item, ["title", "type", "value"]) ||
            typeof item.title !== "string" ||
            !item.title ||
            item.title.trim() !== item.title ||
            item.title.length > ACTIVITY_QUESTION_TITLE_MAX_LENGTH
        ) {
            return null;
        }

        const question = questionnaire?.questions[index];
        if (question && (item.title !== question.title || item.type !== question.type)) {
            return null;
        }

        if (item.type === "bool") {
            if (item.value !== null && typeof item.value !== "boolean") return null;
            answers.push({ title: item.title, type: "bool", value: item.value });
            continue;
        }

        if (item.type === "string" || item.type === "ai") {
            if (
                item.value !== null &&
                (typeof item.value !== "string" ||
                    item.value.trim() !== item.value ||
                    item.value.length > ACTIVITY_QUESTION_STRING_ANSWER_MAX_LENGTH)
            ) {
                return null;
            }
            answers.push({
                title: item.title,
                type: item.type,
                value: item.value || null,
            });
            continue;
        }

        if (item.type !== "multiple" || !Array.isArray(item.value)) return null;
        if (
            item.value.length > ACTIVITY_QUESTION_OPTION_MAX_COUNT ||
            item.value.some((option) =>
                typeof option !== "string" ||
                !option ||
                option.trim() !== option ||
                option.length > ACTIVITY_QUESTION_OPTION_MAX_LENGTH
            ) ||
            new Set(item.value).size !== item.value.length
        ) {
            return null;
        }
        answers.push({ title: item.title, type: "multiple", value: item.value as string[] });
    }

    const parsed = { answers };
    if (jsonByteLength(parsed) > ACTIVITY_QUESTIONNAIRE_MAX_BYTES) return null;
    if (!questionnaire) return parsed;

    // Stored answers are a recovery/hydration source.  They must have the
    // exact questionnaire shape, but required values may legitimately be
    // empty; strict required-field validation remains at final submission.
    const normalizedValues = answers.map((answer, index) => {
        const question = questionnaire.questions[index];
        if (question.type === "bool") return answer.value === true || answer.value === false
            ? answer.value
            : null;
        if (question.type === "string" || question.type === "ai") {
            return typeof answer.value === "string" && answer.value ? answer.value : null;
        }
        const selected = answer.value as string[];
        if (selected.some((option) => !question.params.options.includes(option))) return null;
        return question.params.options.filter((option) => selected.includes(option));
    });
    if (normalizedValues.some((value, index) =>
        questionnaire.questions[index].type === "multiple" && value === null
    )) return null;
    return {
        answers: questionnaire.questions.map((question, index) => ({
            title: question.title,
            type: question.type,
            value: normalizedValues[index] as never,
        })),
    } as ActivityRegistrationAnswers;
}

/** Canonical JSON snapshot shared by client comparisons and server checks. */
export function activityAnswersSnapshot(
    questionnaire: ActivityQuestionnaire,
    values: readonly unknown[],
): string {
    const normalized = emptyActivityAnswerValues(questionnaire);
    for (let index = 0; index < questionnaire.questions.length; index += 1) {
        const question = questionnaire.questions[index];
        const input = values[index];
        if (question.type === "bool") {
            normalized[index] = input === true || input === false ? input : null;
        } else if (question.type === "string" || question.type === "ai") {
            normalized[index] = typeof input === "string" && input.trim() ? input.trim() : null;
        } else if (Array.isArray(input)) {
            const selected = input.filter((item): item is string => typeof item === "string");
            normalized[index] = question.params.options.filter((option) => selected.includes(option));
        }
    }
    return JSON.stringify({
        questions: questionnaire.questions,
        answers: normalized,
    });
}

export async function activityAnswersVersion(
    questionnaire: ActivityQuestionnaire,
    values: readonly unknown[],
): Promise<string> {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(activityAnswersSnapshot(questionnaire, values)),
    );
    const hex = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("");
    return `${ACTIVITY_QUESTIONNAIRE_VERSION_PREFIX}${hex}`;
}

export const activityRegistrationAnswersSnapshot = activityAnswersSnapshot;
export const activityRegistrationAnswersVersion = activityAnswersVersion;
