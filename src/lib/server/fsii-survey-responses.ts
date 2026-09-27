import { and, asc, count, desc, eq, gte, isNotNull, isNull, lte, sql, type SQL } from "drizzle-orm";

import {
    FSII_QUESTIONNAIRE_VERSION,
    FSII_SURVEY_TYPES,
    isCommunityAnswer,
    isSatisfactionAnswer,
    normalizeFsiiSurveyDate,
    type FsiiSurveyType,
} from "$lib/fsii-survey";
import { parseTemporaryParticipantCode } from "$lib/temporary-participant";
import { nowSqlDateTime, rawRun, type AppDb } from "$lib/server/db";
import { schema } from "$lib/server/db-schema";

type ParticipantRef = { kind: "client" | "temporary_participant"; id: number };

type FsiiSurveyWriteRow = {
    clientCode: string;
    answeredDate: string;
    community: [string, string, string, string, string] | null;
    satisfaction: [string, string] | null;
};

export const FSII_SURVEY_RESPONSE_SORTS = [
    "clientCode",
    "surveyType",
    "answeredDate",
] as const;
export type FsiiSurveyResponseSort = (typeof FSII_SURVEY_RESPONSE_SORTS)[number];
export type FsiiSurveyResponseSortDirection = "asc" | "desc";

export const FSII_SURVEY_RESPONSE_PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_FSII_SURVEY_RESPONSE_PAGE_SIZE = 20;

function isFsiiSurveyType(value: unknown): value is FsiiSurveyType {
    return typeof value === "string" && (FSII_SURVEY_TYPES as readonly string[]).includes(value);
}

export type FsiiSurveyResponsePageInput = {
    clientCode?: string;
    surveyType?: FsiiSurveyType;
    dateFrom?: string;
    dateTo?: string;
    sort?: FsiiSurveyResponseSort;
    direction?: FsiiSurveyResponseSortDirection;
    page?: number;
    limit?: number;
};

export type FsiiSurveyResponsePageOptions = {
    clientCode: string;
    surveyType: FsiiSurveyType | undefined;
    dateFrom: string | undefined;
    dateTo: string | undefined;
    sort: FsiiSurveyResponseSort;
    direction: FsiiSurveyResponseSortDirection;
    page: number;
    limit: (typeof FSII_SURVEY_RESPONSE_PAGE_SIZES)[number];
};

export function normalizeFsiiSurveyResponsePageOptions(
    input: FsiiSurveyResponsePageInput = {},
): FsiiSurveyResponsePageOptions {
    const requestedLimit = Number(input.limit);
    const limit = (FSII_SURVEY_RESPONSE_PAGE_SIZES as readonly number[]).includes(requestedLimit)
        ? requestedLimit as FsiiSurveyResponsePageOptions["limit"]
        : DEFAULT_FSII_SURVEY_RESPONSE_PAGE_SIZE;
    const requestedPage = Number(input.page);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 &&
        Number.isSafeInteger((requestedPage - 1) * limit)
        ? requestedPage
        : 1;
    const sort = (FSII_SURVEY_RESPONSE_SORTS as readonly string[]).includes(input.sort ?? "")
        ? input.sort as FsiiSurveyResponseSort
        : "answeredDate";

    return {
        clientCode: input.clientCode?.trim() ?? "",
        surveyType: input.surveyType,
        dateFrom: normalizeFsiiSurveyDate(input.dateFrom ?? "") ?? undefined,
        dateTo: normalizeFsiiSurveyDate(input.dateTo ?? "") ?? undefined,
        sort,
        direction: input.direction === "asc" ? "asc" : "desc",
        page,
        limit,
    };
}

function fsiiSurveyParticipantCode() {
    return sql<string>`COALESCE(${schema.clients.clientCode}, 'TMP' || printf('%04d', ${schema.fsiiSurveyResponses.temporaryParticipantId}))`;
}

function fsiiSurveyAnsweredYear() {
    return sql<number>`CAST(substr(${schema.fsiiSurveyResponses.answeredDate}, 1, 4) AS INTEGER)`;
}

function fsiiSurveyResponseSelection() {
    return {
        id: schema.fsiiSurveyResponses.id,
        clientId: schema.fsiiSurveyResponses.clientId,
        temporaryParticipantId: schema.fsiiSurveyResponses.temporaryParticipantId,
        clientCode: fsiiSurveyParticipantCode(),
        surveyType: schema.fsiiSurveyResponses.surveyType,
        answeredDate: schema.fsiiSurveyResponses.answeredDate,
        uploadedDate: schema.fsiiSurveyResponses.uploadedDate,
        questionnaireVersion: schema.fsiiSurveyResponses.questionnaireVersion,
        answer1: schema.fsiiSurveyResponses.answer1,
        answer2: schema.fsiiSurveyResponses.answer2,
        answer3: schema.fsiiSurveyResponses.answer3,
        answer4: schema.fsiiSurveyResponses.answer4,
        answer5: schema.fsiiSurveyResponses.answer5,
        answer6: schema.fsiiSurveyResponses.answer6,
        answer7: schema.fsiiSurveyResponses.answer7,
        createdBy: schema.fsiiSurveyResponses.createdBy,
        createdAt: schema.fsiiSurveyResponses.createdAt,
    };
}

function fsiiSurveyResponseConditions(input: {
    clientCode?: string;
    surveyType?: FsiiSurveyType;
    answeredDate?: string;
    dateFrom?: string;
    dateTo?: string;
}): SQL[] {
    const conditions: SQL[] = [];
    if (input.surveyType) {
        conditions.push(eq(schema.fsiiSurveyResponses.surveyType, input.surveyType));
    }
    if (input.answeredDate) {
        conditions.push(eq(schema.fsiiSurveyResponses.answeredDate, input.answeredDate));
    }
    if (input.dateFrom) {
        conditions.push(gte(schema.fsiiSurveyResponses.answeredDate, input.dateFrom));
    }
    if (input.dateTo) {
        conditions.push(lte(schema.fsiiSurveyResponses.answeredDate, input.dateTo));
    }
    if (input.clientCode) {
        const code = input.clientCode.trim();
        const temporaryId = parseTemporaryParticipantCode(code);
        conditions.push(temporaryId === null
            ? sql`TRIM(${schema.clients.clientCode}) = ${code} COLLATE NOCASE`
            : eq(schema.fsiiSurveyResponses.temporaryParticipantId, temporaryId));
    }
    return conditions;
}

async function resolveParticipant(db: AppDb, code: string): Promise<ParticipantRef | null> {
    const normalized = code.trim();
    if (!normalized) return null;
    const temporaryId = parseTemporaryParticipantCode(normalized);
    if (temporaryId !== null) {
        const [temporary] = await db
            .select({ id: schema.temporaryParticipants.id })
            .from(schema.temporaryParticipants)
            .where(and(
                eq(schema.temporaryParticipants.id, temporaryId),
                eq(schema.temporaryParticipants.status, "active"),
                isNull(schema.temporaryParticipants.convertedClientId),
            ))
            .limit(1);
        return temporary ? { kind: "temporary_participant", id: temporary.id } : null;
    }
    const [client] = await db
        .select({ id: schema.clients.id })
        .from(schema.clients)
        .where(sql`TRIM(${schema.clients.clientCode}) = ${normalized} COLLATE NOCASE`)
        .limit(1);
    return client ? { kind: "client", id: client.id } : null;
}

function validateSurvey(row: FsiiSurveyWriteRow, type: FsiiSurveyType): string | null {
    if (!row.clientCode) return "missing_client_code";
    if (!normalizeFsiiSurveyDate(row.answeredDate)) return "invalid_answered_date";
    if (type === "community_participation") {
        if (!row.community || row.community.some((answer) => !answer)) return "incomplete_community";
        if (row.community.some((answer) => !isCommunityAnswer(answer))) return "invalid_community_answer";
    } else {
        if (!row.satisfaction || row.satisfaction.some((answer) => !answer)) return "incomplete_satisfaction";
        if (row.satisfaction.some((answer) => !isSatisfactionAnswer(answer))) return "invalid_satisfaction_answer";
    }
    return null;
}

function surveyAnswers(row: FsiiSurveyWriteRow, type: FsiiSurveyType) {
    return type === "community_participation"
        ? { answer1: row.community![0], answer2: row.community![1], answer3: row.community![2], answer4: row.community![3], answer5: row.community![4], answer6: null, answer7: null }
        : { answer1: null, answer2: null, answer3: null, answer4: null, answer5: null, answer6: row.satisfaction![0], answer7: row.satisfaction![1] };
}

function temporarySurveyInsert(
    participantId: number,
    row: FsiiSurveyWriteRow,
    type: FsiiSurveyType,
    createdBy: number | null,
) {
    const answers = surveyAnswers(row, type);
    return {
        sql: `INSERT INTO fsii_survey_responses (
                client_id, temporary_participant_id, survey_type, answered_date,
                questionnaire_version, answer_1, answer_2, answer_3, answer_4,
                answer_5, answer_6, answer_7, created_by, created_at
            )
            SELECT NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE EXISTS (
                SELECT 1 FROM temporary_participants
                WHERE id = ? AND status = 'active'
                  AND converted_client_id IS NULL AND converted_at IS NULL
            )`,
        params: [
            participantId, type, normalizeFsiiSurveyDate(row.answeredDate)!,
            FSII_QUESTIONNAIRE_VERSION, answers.answer1, answers.answer2,
            answers.answer3, answers.answer4, answers.answer5, answers.answer6, answers.answer7, createdBy,
            nowSqlDateTime(), participantId,
        ],
    };
}

function clientSurveyInsert(
    participantId: number,
    row: FsiiSurveyWriteRow,
    type: FsiiSurveyType,
    createdBy: number | null,
) {
    const answers = surveyAnswers(row, type);
    return {
        sql: `INSERT INTO fsii_survey_responses (
                client_id, temporary_participant_id, survey_type, answered_date,
                questionnaire_version, answer_1, answer_2, answer_3, answer_4,
                answer_5, answer_6, answer_7, created_by, created_at
            ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
            participantId, type, normalizeFsiiSurveyDate(row.answeredDate)!,
            FSII_QUESTIONNAIRE_VERSION, answers.answer1, answers.answer2,
            answers.answer3, answers.answer4, answers.answer5, answers.answer6, answers.answer7, createdBy,
            nowSqlDateTime(),
        ],
    };
}

function isDuplicateSurveyError(error: unknown): boolean {
    let current = error;
    while (current instanceof Error) {
        if (current.message.toLowerCase().includes("unique constraint")) return true;
        current = current.cause;
    }
    return false;
}

async function insertSurvey(
    db: AppDb,
    participant: ParticipantRef,
    row: FsiiSurveyWriteRow,
    type: FsiiSurveyType,
    createdBy: number | null,
): Promise<string | null> {
    const answeredDate = normalizeFsiiSurveyDate(row.answeredDate)!;
    const answers = surveyAnswers(row, type);
    try {
        const createdAt = nowSqlDateTime();
        const participantCondition = participant.kind === "temporary_participant"
            ? eq(schema.fsiiSurveyResponses.temporaryParticipantId, participant.id)
            : eq(schema.fsiiSurveyResponses.clientId, participant.id);
        const existing = await db.select({ id: schema.fsiiSurveyResponses.id })
            .from(schema.fsiiSurveyResponses)
            .where(and(participantCondition, eq(schema.fsiiSurveyResponses.answeredDate, answeredDate)))
            .limit(1);
        if (existing[0]) {
            await db.update(schema.fsiiSurveyResponses)
                .set(type === "community_participation"
                    ? { surveyType: "community_participation", ...answers }
                    : { answer6: answers.answer6, answer7: answers.answer7 })
                .where(eq(schema.fsiiSurveyResponses.id, existing[0].id));
            return null;
        }
        if (participant.kind === "temporary_participant") {
            const statement = temporarySurveyInsert(participant.id, row, type, createdBy);
            const write = await rawRun(db, {
                reasonKey: "fsii-survey-responses.active-temporary-write",
                ...statement,
            });
            if (Number(write.meta.changes ?? 0) !== 1) return "unknown_client_code";
        } else {
            await db.insert(schema.fsiiSurveyResponses).values({
                clientId: participant.id,
                temporaryParticipantId: null,
                surveyType: type,
                answeredDate,
                questionnaireVersion: FSII_QUESTIONNAIRE_VERSION,
                ...answers,
                createdBy,
                createdAt,
            });
        }
        return null;
    } catch (error) {
        if (isDuplicateSurveyError(error)) return "duplicate";
        throw error;
    }
}

export async function createManualFsiiSurveyResponses(
    db: AppDb,
    input: {
        clientCode: string;
        form: FormData;
        createdBy?: number | null;
    },
): Promise<string | null> {
    const rawTypes = input.form.getAll("surveyType").map(String);
    if (rawTypes.length === 0) return "no_survey_types";
    if (rawTypes.some((value) => !isFsiiSurveyType(value)) ||
        new Set(rawTypes).size !== rawTypes.length) return "invalid_survey_type";

    const surveyTypes = FSII_SURVEY_TYPES.filter((type) => rawTypes.includes(type));
    const row: FsiiSurveyWriteRow = {
        clientCode: input.clientCode,
        answeredDate: String(input.form.get("answeredDate") ?? ""),
        community: surveyTypes.includes("community_participation")
            ? [1, 2, 3, 4, 5].map((index) =>
                String(input.form.get(`communityAnswer${index}`) ?? "").trim()
            ) as FsiiSurveyWriteRow["community"]
            : null,
        satisfaction: surveyTypes.includes("satisfaction")
            ? [1, 2].map((index) =>
                String(input.form.get(`satisfactionAnswer${index}`) ?? "").trim()
            ) as FsiiSurveyWriteRow["satisfaction"]
            : null,
    };

    for (const surveyType of surveyTypes) {
        const validation = validateSurvey(row, surveyType);
        if (validation) return validation;
    }

    const participant = await resolveParticipant(db, input.clientCode);
    if (!participant) return "unknown_client_code";
    const createdBy = input.createdBy ?? null;

    try {
        if (surveyTypes.length === 1) {
            return await insertSurvey(db, participant, row, surveyTypes[0], createdBy);
        }
        const first = await insertSurvey(db, participant, row, surveyTypes[0], createdBy);
        if (first) return first;
        return await insertSurvey(db, participant, row, surveyTypes[1], createdBy);
    } catch (error) {
        return isDuplicateSurveyError(error) ? "duplicate" : "write_failed";
    }
}

export async function listFsiiSurveyResponses(db: AppDb, filters?: {
    clientCode?: string;
    surveyType?: FsiiSurveyType;
    answeredDate?: string;
}) {
    const conditions = fsiiSurveyResponseConditions(filters ?? {});
    return db.select(fsiiSurveyResponseSelection()).from(schema.fsiiSurveyResponses)
        .leftJoin(schema.clients, eq(schema.fsiiSurveyResponses.clientId, schema.clients.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(schema.fsiiSurveyResponses.answeredDate), desc(schema.fsiiSurveyResponses.id));
}

export async function listFsiiSurveyResponsePage(
    db: AppDb,
    input: FsiiSurveyResponsePageInput = {},
) {
    const options = normalizeFsiiSurveyResponsePageOptions(input);
    const conditions = fsiiSurveyResponseConditions(options);
    const where = conditions.length ? and(...conditions) : undefined;
    const uploadedWhere = and(...conditions, isNotNull(schema.fsiiSurveyResponses.uploadedDate));
    const sortExpression = options.sort === "clientCode"
        ? sql`${fsiiSurveyParticipantCode()} COLLATE NOCASE`
        : options.sort === "surveyType"
            ? schema.fsiiSurveyResponses.surveyType
            : schema.fsiiSurveyResponses.answeredDate;
    const order = options.direction === "asc" ? asc : desc;

    const [countRows, uploadedCountRows, rows, participantRows, yearRows] = await Promise.all([
        db.select({ value: count() })
            .from(schema.fsiiSurveyResponses)
            .leftJoin(schema.clients, eq(schema.fsiiSurveyResponses.clientId, schema.clients.id))
            .where(where),
        db.select({ value: count() })
            .from(schema.fsiiSurveyResponses)
            .leftJoin(schema.clients, eq(schema.fsiiSurveyResponses.clientId, schema.clients.id))
            .where(uploadedWhere),
        db.select(fsiiSurveyResponseSelection())
            .from(schema.fsiiSurveyResponses)
            .leftJoin(schema.clients, eq(schema.fsiiSurveyResponses.clientId, schema.clients.id))
            .where(where)
            .orderBy(
                order(sortExpression),
                order(schema.fsiiSurveyResponses.id),
            )
            .limit(options.limit)
            .offset((options.page - 1) * options.limit),
        db.selectDistinct({ clientCode: fsiiSurveyParticipantCode() })
            .from(schema.fsiiSurveyResponses)
            .leftJoin(schema.clients, eq(schema.fsiiSurveyResponses.clientId, schema.clients.id))
            .orderBy(asc(sql`${fsiiSurveyParticipantCode()} COLLATE NOCASE`)),
        db.selectDistinct({ year: fsiiSurveyAnsweredYear() })
            .from(schema.fsiiSurveyResponses)
            .orderBy(desc(fsiiSurveyAnsweredYear())),
    ]);

    return {
        rows,
        totalRows: Number(countRows[0]?.value ?? 0),
        uploadedRows: Number(uploadedCountRows[0]?.value ?? 0),
        participantCodes: participantRows
            .map((row) => row.clientCode.trim())
            .filter(Boolean),
        answeredYears: yearRows
            .map((row) => Number(row.year))
            .filter((year) => Number.isSafeInteger(year) && year >= 1 && year <= 9999),
        options,
    };
}
