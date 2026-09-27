import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { buildChineseNameSearchIndex } from "./client-name-index.ts";
import {
    cleanTemporaryParticipantLegalName,
    isTemporaryParticipantGender,
    normalizeTemporaryParticipantLegalName,
    normalizeTemporaryParticipantStructuredName,
    parseTemporaryParticipantCode,
    type TemporaryParticipantGender,
    type TemporaryParticipantInput,
    validateTemporaryParticipantInput,
} from "../temporary-participant.ts";
import {
    sqliteNormalizedFirstLastNameExpression,
    sqliteNormalizedFirstLastNameSql,
} from "./legal-name.ts";
import type {
    ActivityRegistrationContact,
    ActivityRegistrationDobOutcome,
    ActivityRegistrationMemberOutcome,
} from "../activity-registration.ts";
import {
    activityAnswersVersion,
    emptyActivityAnswerValues,
    parseStoredActivityRegistrationAnswers,
    validateActivityAnswerValues,
    validateActivityQuestionnaire,
    type ActivityQuestionnaire,
    type ActivityRegistrationAnswers,
} from "../activity-questionnaire.ts";
import { equalsAsciiCaseInsensitive } from "../activity-registration.ts";
import { todayBusinessDate } from "../local-date.ts";
import { replaceTraditionalChineseCharacters } from "../traditional-chinese.ts";
import {
    rawBatch,
    rawAll,
    rawFirst,
    rawRun,
    type AppDb,
    nowSqlDateTime,
} from "./db.ts";
import { schema } from "./db-schema.ts";
import type {
    ActivityCapacitySummary,
    ActivityIntegrityPolicy,
    ActivityIntegritySummary,
    RegistrationSnapshot,
} from "../activity-registration-state.ts";

export const ACTIVITY_REGISTRATION_TURNSTILE_ACTION = "activity-registration-v1";

type ParticipantKind = "client" | "child_member" | "temporary_participant";

export type ResolvedActivityParticipant = ActivityRegistrationContact & {
    kind: ParticipantKind;
    id: number;
    code: string;
};

type ActivityAiAnswerProjectionRow = Pick<StoredActivityRegistration,
    "clientId" | "childMemberId" | "temporaryParticipantId" | "answers"
>;

export function projectCurrentActiveActivityAiAnswers(
    rows: readonly ActivityAiAnswerProjectionRow[],
    input: {
        questionnaire: ActivityQuestionnaire;
        questionId: string;
        participant: ResolvedActivityParticipant;
    },
): string[] {
    const questionIndex = input.questionnaire.questions.findIndex((question) =>
        question.type === "ai" && question.id === input.questionId
    );
    if (questionIndex < 0) return [];
    const answers: string[] = [];
    for (const row of rows) {
        if (storedRegistrationMatchesParticipant({
            id: 0, registrationStatus: "active", registeredAt: null, waitlistedAt: null,
            integrityLateCancelledAt: null, ...row,
        }, input.participant)) continue;
        const parsed = parseStoredActivityRegistrationAnswers(row.answers, input.questionnaire);
        const answer = parsed?.answers[questionIndex];
        if (answer?.type === "ai" && typeof answer.value === "string" && answer.value) answers.push(answer.value);
    }
    return answers;
}

export async function listCurrentActiveActivityAiAnswers(
    db: AppDb,
    input: {
        activityId: number;
        questionnaire: ActivityQuestionnaire;
        questionId: string;
        participant: ResolvedActivityParticipant;
    },
): Promise<string[]> {
    const rows = await db.select({
        clientId: schema.activityRegistrations.clientId,
        childMemberId: schema.activityRegistrations.childMemberId,
        temporaryParticipantId: schema.activityRegistrations.temporaryParticipantId,
        answers: schema.activityRegistrations.answers,
    }).from(schema.activityRegistrations).where(and(
        eq(schema.activityRegistrations.activityId, input.activityId),
        eq(schema.activityRegistrations.registrationStatus, "active"),
    )).orderBy(asc(schema.activityRegistrations.id));

    return projectCurrentActiveActivityAiAnswers(rows, input);
}

export type MemberIdentityLookup = {
    outcome: ActivityRegistrationMemberOutcome;
    participant: ResolvedActivityParticipant | null;
};

export type DobIdentityLookup = {
    outcome: ActivityRegistrationDobOutcome;
    participant: ResolvedActivityParticipant | null;
};

export type ActivityOption = {
    id: number;
    name: string;
    heldAt: string | null;
    questions: ActivityQuestionnaire;
    capacity: ActivityCapacitySummary;
    integrityPolicy: ActivityIntegrityPolicy;
};

export type PublicActivityCatalogItem = {
    id: number;
    title: string;
    image: string | null;
    heldAt: string | null;
};

export type PublicActivityImage = {
    r2Key: string;
    originalName: string;
    mimeType: string;
};

const PUBLIC_ACTIVITY_CORS_ORIGINS = new Set([
    "https://scsc.ca",
    "https://www.scsc.ca",
    "https://scsc-official-website.it-8e6.workers.dev",
]);

export function publicActivityCorsHeaders(
    request: Request,
): { allowed: boolean; headers: Headers } {
    const headers = new Headers({ Vary: "Origin" });
    const origin = request.headers.get("Origin");
    if (origin === null) {
        return { allowed: request.method !== "OPTIONS", headers };
    }
    if (!PUBLIC_ACTIVITY_CORS_ORIGINS.has(origin)) {
        return { allowed: false, headers };
    }
    headers.set("Access-Control-Allow-Origin", origin);
    if (request.method === "OPTIONS") {
        headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        headers.set("Access-Control-Max-Age", "86400");
    }
    return { allowed: true, headers };
}

export type ActivityRegistrationResult =
    | "registered"
    | "waitlisted"
    | "already_registered"
    | "already_waitlisted"
    | "integrity_blocked"
    | "full";
export type ActivityRegistrationRejectionCode = "identity_conflict" | "participant_inactive";

export class ActivityRegistrationRejectedError extends Error {
    readonly code: ActivityRegistrationRejectionCode;

    constructor(code: ActivityRegistrationRejectionCode) {
        super(code);
        this.name = "ActivityRegistrationRejectedError";
        this.code = code;
    }
}

type PersonRow = ResolvedActivityParticipant & {
    chineseName: string;
    englishName: string | null;
    firstName: string | null;
    lastName: string | null;
    legalName: string | null;
    dob: string | null;
};

type StoredActivityRegistration = {
    id: number;
    clientId: number | null;
    childMemberId: number | null;
    temporaryParticipantId: number | null;
    registrationStatus: "active" | "waitlisted" | "cancelled";
    registeredAt: string | null;
    waitlistedAt: string | null;
    integrityLateCancelledAt: string | null;
    answers: unknown;
};

function emptyAnswers(questionnaire: ActivityQuestionnaire): ActivityRegistrationAnswers {
    return { answers: questionnaire.questions.map((question, index) => ({
        title: question.title,
        type: question.type,
        value: emptyActivityAnswerValues(questionnaire)[index] as never,
    })) };
}

type StoredTemporaryParticipant = {
    id: number;
    code: string;
    gender: TemporaryParticipantGender | null;
    tel: string;
    email: string;
    // Nullable since the dob age-only mode; rows fetched here are always
    // matched through the eq(dob, ...) predicate, so a matched row keeps a
    // non-null dob at runtime.
    dob: string | null;
    status: "active" | "disabled";
};

type RegistrationBindValue = string | number | null;

export type ActivityLifecycleStatement = {
    sql: string;
    params: RegistrationBindValue[];
};

function eligibleWaitlistRegistrationSql(alias: string): string {
    return `${alias}.waitlisted_at IS NOT NULL AND (
        (${alias}.client_id IS NOT NULL
            AND ${alias}.child_member_id IS NULL
            AND ${alias}.temporary_participant_id IS NULL
            AND EXISTS (
                SELECT 1 FROM clients AS eligible_client
                WHERE eligible_client.id = ${alias}.client_id
                  AND eligible_client.client_code = ${alias}.client_code
                  AND eligible_client.status = 'active'
            ))
        OR (${alias}.client_id IS NULL
            AND ${alias}.child_member_id IS NOT NULL
            AND ${alias}.temporary_participant_id IS NULL
            AND EXISTS (
                SELECT 1 FROM child_members AS eligible_child
                WHERE eligible_child.id = ${alias}.child_member_id
                  AND eligible_child.child_code = ${alias}.client_code
                  AND eligible_child.status = 'active'
            ))
        OR (${alias}.client_id IS NULL
            AND ${alias}.child_member_id IS NULL
            AND ${alias}.temporary_participant_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM temporary_participants AS eligible_temporary
                WHERE eligible_temporary.id = ${alias}.temporary_participant_id
                  AND 'TMP' || printf('%04d', eligible_temporary.id) = ${alias}.client_code
                  AND eligible_temporary.status = 'active'
            ))
    )`;
}

const WAITLIST_LIMIT_SQL = `CASE
    WHEN activity.expected_participants * activity.waitlist_percentage + 99 < 100 THEN 1
    ELSE CAST((activity.expected_participants * activity.waitlist_percentage + 99) / 100 AS INTEGER)
END`;

function publicActivityAvailabilitySql(alias = "activity"): string {
    return `(${alias}.held_at IS NULL OR substr(${alias}.held_at, 1, 10) >= ?)`;
}

type CapacityIncreaseGuard = {
    activityId: number;
    expectedRevision: number;
    expectedImageAssetId: number | null;
    name: string;
    description: string;
    projectId: number | null;
    preserveExistingProjectId?: boolean;
    heldAt: string | null;
    expectedParticipants: number;
    previousExpectedParticipants?: number;
    waitlistPercentage: number;
    integrityEnabled: boolean;
    questions: ActivityQuestionnaire;
    timestamp: string;
};

function capacityIncreaseGuardSql(): string {
    return `activity.id = ? AND activity.status = 'active'
        AND activity.edit_revision = ?
        AND activity.name = ?
        AND activity.description IS ?
        AND (? = 1 OR activity.project_id IS ?)
        AND activity.image_asset_id IS ?
        AND activity.held_at IS ?
        AND activity.expected_participants = ?
        AND activity.waitlist_percentage = ?
        AND activity.integrity_enabled = ?
        AND activity.questions = ?`;
}

function capacityIncreaseGuardParams(input: CapacityIncreaseGuard): RegistrationBindValue[] {
    return [
        input.activityId,
        input.expectedRevision + 1,
        input.name,
        input.description || null,
        input.preserveExistingProjectId ? 1 : 0,
        input.projectId,
        input.expectedImageAssetId,
        input.heldAt,
        input.expectedParticipants,
        input.waitlistPercentage,
        input.integrityEnabled ? 1 : 0,
        JSON.stringify(input.questions),
    ];
}

export function buildActivityCapacityIncreaseStatements(
    input: CapacityIncreaseGuard,
): ActivityLifecycleStatement[] {
    const enabled = input.previousExpectedParticipants !== undefined &&
        input.expectedParticipants > input.previousExpectedParticipants
        ? 1
        : 0;
    const guardSql = capacityIncreaseGuardSql();
    const guardParams = capacityIncreaseGuardParams(input);
    const integrityPrefix = input.integrityEnabled ? `${INTEGRITY_CLOCK_CTE}\n` : "";
    const invalidWaitlistPredicate = input.integrityEnabled
        ? `(NOT (${eligibleWaitlistRegistrationSql("registration")})
            OR ${integrityLossCountForRegistrationSql("registration")} >= 3)`
        : `NOT (${eligibleWaitlistRegistrationSql("registration")})`;
    const candidateIntegrityPredicate = input.integrityEnabled
        ? `AND ${integrityLossCountForRegistrationSql("candidate")} < 3`
        : "";
    return [
        {
            sql: `${integrityPrefix}UPDATE activity_registrations AS registration
                SET registration_status = 'cancelled',
                    registration_updated_at = ?, updated_at = ?
                WHERE registration.activity_id = ?
                  AND registration.registration_status = 'waitlisted'
                  AND ${invalidWaitlistPredicate}
                  AND ? = 1
                  AND EXISTS (
                    SELECT 1 FROM activities AS activity WHERE ${guardSql}
                  )`,
            params: [
                ...(input.integrityEnabled ? integrityClockParams(input.timestamp) : []),
                input.timestamp,
                input.timestamp,
                input.activityId,
                enabled,
                ...guardParams,
            ],
        },
        {
            sql: `${integrityPrefix}UPDATE activity_registrations AS registration
                SET registration_status = 'active', registered_at = ?,
                    registration_updated_at = ?, updated_at = ?
                WHERE registration.id IN (
                    SELECT candidate.id
                    FROM activity_registrations AS candidate
                    WHERE candidate.activity_id = ?
                      AND candidate.registration_status = 'waitlisted'
                      AND ${eligibleWaitlistRegistrationSql("candidate")}
                      ${candidateIntegrityPredicate}
                    ORDER BY candidate.waitlisted_at ASC, candidate.id ASC
                    LIMIT COALESCE((
                        SELECT CASE
                            WHEN activity.expected_participants > (
                                SELECT COUNT(*) FROM activity_registrations AS active_registration
                                WHERE active_registration.activity_id = activity.id
                                  AND active_registration.registration_status = 'active'
                            ) THEN activity.expected_participants - (
                                SELECT COUNT(*) FROM activity_registrations AS active_registration
                                WHERE active_registration.activity_id = activity.id
                                  AND active_registration.registration_status = 'active'
                            )
                            ELSE 0
                        END
                        FROM activities AS activity
                        WHERE ${guardSql}
                    ), 0)
                )
                  AND ? = 1
                  AND EXISTS (
                    SELECT 1 FROM activities AS activity WHERE ${guardSql}
                  )`,
            params: [
                ...(input.integrityEnabled ? integrityClockParams(input.timestamp) : []),
                input.timestamp,
                input.timestamp,
                input.timestamp,
                input.activityId,
                ...guardParams,
                enabled,
                ...guardParams,
            ],
        },
    ];
}

type ParticipantRegistrationSource = {
    tableName: "clients" | "child_members" | "temporary_participants";
    codeExpression: string;
    participantColumns: string;
    activePredicate: string;
    activeParams: RegistrationBindValue[];
    registrationPredicate: string;
    registrationParams: RegistrationBindValue[];
};

const INTEGRITY_CLOCK_CTE = "WITH integrity_clock(current_year, now_value) AS (VALUES (?, ?))";

function registrationIdentityMatchSql(leftAlias: string, rightAlias: string): string {
    return `((${rightAlias}.client_id IS NOT NULL
            AND ${leftAlias}.client_id = ${rightAlias}.client_id
            AND ${leftAlias}.child_member_id IS NULL
            AND ${leftAlias}.temporary_participant_id IS NULL)
        OR (${rightAlias}.child_member_id IS NOT NULL
            AND ${leftAlias}.client_id IS NULL
            AND ${leftAlias}.child_member_id = ${rightAlias}.child_member_id
            AND ${leftAlias}.temporary_participant_id IS NULL)
        OR (${rightAlias}.temporary_participant_id IS NOT NULL
            AND ${leftAlias}.client_id IS NULL
            AND ${leftAlias}.child_member_id IS NULL
            AND ${leftAlias}.temporary_participant_id = ${rightAlias}.temporary_participant_id))`;
}

function integrityLossCountSql(identityPredicate: string): string {
    return `(SELECT COUNT(DISTINCT integrity_loss_activity.id)
        FROM activity_registrations AS integrity_loss_registration
        JOIN activities AS integrity_loss_activity
          ON integrity_loss_activity.id = integrity_loss_registration.activity_id
        WHERE integrity_loss_activity.integrity_enabled = 1
          AND substr(integrity_loss_activity.held_at, 1, 4) = (
            SELECT current_year FROM integrity_clock
          )
          AND ${identityPredicate}
          AND (
            integrity_loss_registration.integrity_late_cancelled_at IS NOT NULL
            OR (
              integrity_loss_registration.registration_status = 'active'
              AND integrity_loss_registration.registered_at IS NOT NULL
              AND integrity_loss_registration.registered_at < datetime(
                date(integrity_loss_activity.held_at), '-1 day', '+22 hours'
              )
              AND (SELECT now_value FROM integrity_clock) >= datetime(
                date(integrity_loss_activity.held_at), '+1 day'
              )
              AND NOT EXISTS (
                SELECT 1 FROM activity_attendance AS integrity_attendance
                WHERE integrity_attendance.activity_id = integrity_loss_activity.id
                  AND integrity_attendance.attendance_status = 'active'
                  AND ${registrationIdentityMatchSql("integrity_attendance", "integrity_loss_registration")}
              )
            )
          ))`;
}

function integrityLossCountForParticipantSql(source: ParticipantRegistrationSource): string {
    return integrityLossCountSql(
        source.registrationPredicate.replaceAll("registration.", "integrity_loss_registration."),
    );
}

function integrityLossCountForRegistrationSql(registrationAlias: string): string {
    return integrityLossCountSql(
        registrationIdentityMatchSql("integrity_loss_registration", registrationAlias),
    );
}

function integrityClockParams(timestamp: string): RegistrationBindValue[] {
    return [timestamp.slice(0, 4), timestamp];
}

function integritySummaryFromLossCount(lossCount: number): ActivityIntegritySummary {
    const normalized = Number.isSafeInteger(lossCount) && lossCount > 0 ? lossCount : 0;
    return {
        lossCount: normalized,
        percentage: normalized === 0 ? 100 : normalized === 1 ? 67 : normalized === 2 ? 33 : 0,
        registrationBlocked: normalized >= 3,
    };
}

function parseSubmissionActivityRegistrationAnswers(
    value: unknown,
    questionnaire: ActivityQuestionnaire,
): ActivityRegistrationAnswers | null {
    const parsed = parseStoredActivityRegistrationAnswers(value, questionnaire);
    if (!parsed) return null;
    const result = validateActivityAnswerValues(
        questionnaire,
        parsed.answers.map((answer) => answer.value),
    );
    return result.ok ? result.value : null;
}

function isReservedTemporaryParticipantCode(code: string): boolean {
    return code.trim().toUpperCase().startsWith("TMP");
}

function participantRegistrationSource(
    participant: ResolvedActivityParticipant,
): ParticipantRegistrationSource {
    if (participant.kind === "client") {
        return {
            tableName: "clients",
            codeExpression: "participant.client_code",
            participantColumns: "participant.id, NULL, NULL",
            activePredicate: "participant.id = ? AND participant.client_code = ? AND participant.status = 'active'",
            activeParams: [participant.id, participant.code],
            registrationPredicate: `registration.client_id = ?
                AND registration.child_member_id IS NULL
                AND registration.temporary_participant_id IS NULL`,
            registrationParams: [participant.id],
        };
    }
    if (participant.kind === "child_member") {
        return {
            tableName: "child_members",
            codeExpression: "participant.child_code",
            participantColumns: "NULL, participant.id, NULL",
            activePredicate: "participant.id = ? AND participant.child_code = ? AND participant.status = 'active'",
            activeParams: [participant.id, participant.code],
            registrationPredicate: `registration.client_id IS NULL
                AND registration.child_member_id = ?
                AND registration.temporary_participant_id IS NULL`,
            registrationParams: [participant.id],
        };
    }
    return {
        tableName: "temporary_participants",
        codeExpression: "'TMP' || printf('%04d', participant.id)",
        participantColumns: "NULL, NULL, participant.id",
        activePredicate: `participant.id = ?
            AND 'TMP' || printf('%04d', participant.id) = ?
            AND participant.status = 'active'`,
        activeParams: [participant.id, participant.code],
        registrationPredicate: `registration.client_id IS NULL
            AND registration.child_member_id IS NULL
            AND registration.temporary_participant_id = ?`,
        registrationParams: [participant.id],
    };
}

export async function getPublicActivityIntegritySummary(
    db: AppDb,
    participant: ResolvedActivityParticipant,
    now = new Date(),
): Promise<ActivityIntegritySummary> {
    const source = participantRegistrationSource(participant);
    const timestamp = nowSqlDateTime(now);
    const lossCountSql = integrityLossCountForParticipantSql(source);
    await rawRun(db, {
        reasonKey: "public-activity-registration.atomic-write",
        sql: `${INTEGRITY_CLOCK_CTE}
            UPDATE activity_registrations AS registration
            SET registration_status = 'cancelled',
                registration_updated_at = ?, updated_at = ?
            WHERE registration.registration_status = 'waitlisted'
              AND ${source.registrationPredicate}
              AND EXISTS (
                SELECT 1 FROM activities AS queued_activity
                WHERE queued_activity.id = registration.activity_id
                  AND queued_activity.integrity_enabled = 1
              )
              AND ${lossCountSql} >= 3`,
        params: [
            ...integrityClockParams(timestamp),
            timestamp,
            timestamp,
            ...source.registrationParams,
            ...source.registrationParams,
        ],
    });
    const row = await rawFirst<{ loss_count: number }>(db, {
        reasonKey: "public-activity-registration.atomic-write",
        sql: `${INTEGRITY_CLOCK_CTE}
            SELECT ${lossCountSql} AS loss_count`,
        params: [
            ...integrityClockParams(timestamp),
            ...source.registrationParams,
        ],
    });
    if (!row || !Number.isSafeInteger(Number(row.loss_count)) || Number(row.loss_count) < 0) {
        throw new Error("activity_integrity_summary_unavailable");
    }
    return integritySummaryFromLossCount(Number(row.loss_count));
}

function personNamePredicate(columns: {
    chineseName: typeof schema.clients.chineseName | typeof schema.childMembers.chineseName;
    englishName: typeof schema.clients.englishName | typeof schema.childMembers.englishName;
    firstName: typeof schema.clients.firstName | typeof schema.childMembers.firstName;
    lastName: typeof schema.clients.lastName | typeof schema.childMembers.lastName;
}, name: string) {
    return or(
        sql<boolean>`TRIM(${columns.chineseName}) = ${name}`,
        sql<boolean>`TRIM(COALESCE(${columns.englishName}, '')) = ${name} COLLATE NOCASE`,
        sql<boolean>`CASE
            WHEN TRIM(COALESCE(${columns.firstName}, '')) <> ''
             AND TRIM(COALESCE(${columns.lastName}, '')) <> ''
            THEN TRIM(${columns.firstName}) || ' ' || TRIM(${columns.lastName})
            ELSE ''
        END = ${name} COLLATE NOCASE`,
    );
}

function personRowMatchesName(row: PersonRow, name: string): boolean {
    if (row.kind === "temporary_participant") {
        return row.legalName
            ? normalizeTemporaryParticipantLegalName(row.legalName) ===
                normalizeTemporaryParticipantLegalName(name)
            : false;
    }
    if (
        replaceTraditionalChineseCharacters(row.chineseName.trim()) ===
            replaceTraditionalChineseCharacters(name.trim())
    ) return true;
    if (row.englishName && equalsAsciiCaseInsensitive(row.englishName.trim(), name.trim())) {
        return true;
    }
    const firstName = row.firstName?.trim() ?? "";
    const lastName = row.lastName?.trim() ?? "";
    return Boolean(
        firstName &&
        lastName &&
        equalsAsciiCaseInsensitive(`${firstName} ${lastName}`, name.trim()),
    );
}

function contactValue(value: string | null): string | null {
    return value?.trim() || null;
}

function normalizeGender(value: string | null): TemporaryParticipantGender | null {
    return isTemporaryParticipantGender(value) ? value : null;
}

function clientRow(row: {
    id: number;
    code: string;
    chineseName: string;
    englishName: string | null;
    firstName: string | null;
    lastName: string | null;
    dob: string | null;
    gender: string | null;
    tel: string | null;
    email: string | null;
}): PersonRow {
    return {
        kind: "client",
        id: row.id,
        code: row.code,
        chineseName: row.chineseName,
        englishName: row.englishName,
        firstName: row.firstName,
        lastName: row.lastName,
        legalName: null,
        dob: row.dob,
        gender: normalizeGender(row.gender),
        tel: contactValue(row.tel),
        email: contactValue(row.email),
    };
}

function childRow(row: {
    id: number;
    code: string;
    chineseName: string;
    englishName: string | null;
    firstName: string | null;
    lastName: string | null;
    dob: string | null;
    gender: string | null;
    tel: string | null;
    email: string | null;
}): PersonRow {
    return { ...clientRow(row), kind: "child_member" };
}

function temporaryRow(row: {
    id: number;
    code: string;
    legalName: string;
    // Nullable since the dob age-only mode; age-only rows simply never match
    // a submitted dob through the eq predicates above.
    dob: string | null;
    gender: TemporaryParticipantGender | null;
    tel: string;
    email: string;
}): PersonRow {
    return {
        kind: "temporary_participant",
        id: row.id,
        code: row.code,
        chineseName: row.legalName,
        englishName: null,
        firstName: null,
        lastName: null,
        legalName: row.legalName,
        dob: row.dob,
        gender: row.gender,
        tel: contactValue(row.tel),
        email: contactValue(row.email),
    };
}

async function selectPeopleByName(
    db: AppDb,
    name: string,
    options?: { equivalentMemberChineseName: boolean; dob?: string },
): Promise<PersonRow[]> {
    const normalizedTemporaryName = normalizeTemporaryParticipantLegalName(name);
    const memberDobPredicate = options?.dob === undefined
        ? undefined
        : eq(schema.clients.dob, options.dob);
    const childDobPredicate = options?.dob === undefined
        ? undefined
        : eq(schema.childMembers.dob, options.dob);
    const temporaryDobPredicate = options?.dob === undefined
        ? undefined
        : eq(schema.temporaryParticipants.dob, options.dob);
    const clientNames = {
        chineseName: schema.clients.chineseName,
        englishName: schema.clients.englishName,
        firstName: schema.clients.firstName,
        lastName: schema.clients.lastName,
    };
    const childNames = {
        chineseName: schema.childMembers.chineseName,
        englishName: schema.childMembers.englishName,
        firstName: schema.childMembers.firstName,
        lastName: schema.childMembers.lastName,
    };
    const [clients, children, temporary] = await Promise.all([
        db.select({
            id: schema.clients.id,
            code: schema.clients.clientCode,
            chineseName: schema.clients.chineseName,
            englishName: schema.clients.englishName,
            firstName: schema.clients.firstName,
            lastName: schema.clients.lastName,
            dob: schema.clients.dob,
            gender: schema.clients.gender,
            tel: schema.clients.tel,
            email: schema.clients.email,
        }).from(schema.clients).where(and(
            eq(schema.clients.status, "active"),
            memberDobPredicate,
            options?.equivalentMemberChineseName ? undefined : personNamePredicate(clientNames, name),
        )),
        db.select({
            id: schema.childMembers.id,
            code: schema.childMembers.childCode,
            chineseName: schema.childMembers.chineseName,
            englishName: schema.childMembers.englishName,
            firstName: schema.childMembers.firstName,
            lastName: schema.childMembers.lastName,
            dob: schema.childMembers.dob,
            gender: schema.childMembers.gender,
            tel: schema.childMembers.tel,
            email: schema.childMembers.email,
        }).from(schema.childMembers).where(and(
            eq(schema.childMembers.status, "active"),
            childDobPredicate,
            options?.equivalentMemberChineseName ? undefined : personNamePredicate(childNames, name),
        )),
        db.select({
            id: schema.temporaryParticipants.id,
            code: sql<string>`'TMP' || printf('%04d', ${schema.temporaryParticipants.id})`,
            legalName: sql<string>`trim(${schema.temporaryParticipants.firstName}) || ' ' || trim(${schema.temporaryParticipants.lastName})`,
            dob: schema.temporaryParticipants.dob,
            gender: schema.temporaryParticipants.gender,
            tel: schema.temporaryParticipants.tel,
            email: schema.temporaryParticipants.email,
        }).from(schema.temporaryParticipants).where(and(
            eq(schema.temporaryParticipants.status, "active"),
            eq(
                sqliteNormalizedFirstLastNameSql(
                    schema.temporaryParticipants.firstName,
                    schema.temporaryParticipants.lastName,
                ),
                normalizedTemporaryName,
            ),
            temporaryDobPredicate,
        )),
    ]);
    const rows = [
        ...clients.map(clientRow),
        ...children.map(childRow),
        ...temporary.map(temporaryRow),
    ];
    return options?.equivalentMemberChineseName
        ? rows.filter((row) => personRowMatchesName(row, name))
        : rows;
}

async function selectPeopleByCode(db: AppDb, code: string): Promise<PersonRow[]> {
    if (isReservedTemporaryParticipantCode(code)) {
        const temporaryParticipantId = parseTemporaryParticipantCode(code);
        if (temporaryParticipantId === null) return [];
        const temporary = await db.select({
            id: schema.temporaryParticipants.id,
            code: sql<string>`'TMP' || printf('%04d', ${schema.temporaryParticipants.id})`,
            legalName: sql<string>`trim(${schema.temporaryParticipants.firstName}) || ' ' || trim(${schema.temporaryParticipants.lastName})`,
            dob: schema.temporaryParticipants.dob,
            gender: schema.temporaryParticipants.gender,
            tel: schema.temporaryParticipants.tel,
            email: schema.temporaryParticipants.email,
        }).from(schema.temporaryParticipants).where(and(
            eq(schema.temporaryParticipants.status, "active"),
            eq(schema.temporaryParticipants.id, temporaryParticipantId),
        ));
        return temporary.map(temporaryRow);
    }

    const [clients, children, temporary] = await Promise.all([
        db.select({
            id: schema.clients.id,
            code: schema.clients.clientCode,
            chineseName: schema.clients.chineseName,
            englishName: schema.clients.englishName,
            firstName: schema.clients.firstName,
            lastName: schema.clients.lastName,
            dob: schema.clients.dob,
            gender: schema.clients.gender,
            tel: schema.clients.tel,
            email: schema.clients.email,
        }).from(schema.clients).where(and(eq(schema.clients.status, "active"), sql<boolean>`TRIM(${schema.clients.clientCode}) = ${code} COLLATE NOCASE`)),
        db.select({
            id: schema.childMembers.id,
            code: schema.childMembers.childCode,
            chineseName: schema.childMembers.chineseName,
            englishName: schema.childMembers.englishName,
            firstName: schema.childMembers.firstName,
            lastName: schema.childMembers.lastName,
            dob: schema.childMembers.dob,
            gender: schema.childMembers.gender,
            tel: schema.childMembers.tel,
            email: schema.childMembers.email,
        }).from(schema.childMembers).where(and(eq(schema.childMembers.status, "active"), sql<boolean>`TRIM(${schema.childMembers.childCode}) = ${code} COLLATE NOCASE`)),
        db.select({
            id: schema.temporaryParticipants.id,
            code: sql<string>`'TMP' || printf('%04d', ${schema.temporaryParticipants.id})`,
            legalName: sql<string>`trim(${schema.temporaryParticipants.firstName}) || ' ' || trim(${schema.temporaryParticipants.lastName})`,
            dob: schema.temporaryParticipants.dob,
            gender: schema.temporaryParticipants.gender,
            tel: schema.temporaryParticipants.tel,
            email: schema.temporaryParticipants.email,
        }).from(schema.temporaryParticipants).where(and(
            eq(schema.temporaryParticipants.status, "active"),
            sql<boolean>`'TMP' || printf('%04d', ${schema.temporaryParticipants.id}) = ${code} COLLATE NOCASE`,
        )),
    ]);
    return [
        ...clients.map(clientRow),
        ...children.map(childRow),
        ...temporary.map(temporaryRow),
    ];
}

function participantContact(row: PersonRow): ResolvedActivityParticipant {
    return {
        kind: row.kind,
        id: row.id,
        code: row.code,
        gender: row.gender,
        tel: row.tel,
        email: row.email,
    };
}

export async function findMemberIdentity(
    db: AppDb,
    input: { memberCode: string; name: string; dob?: string },
): Promise<MemberIdentityLookup | DobIdentityLookup> {
    const name = input.name.trim();
    const code = input.memberCode.trim();

    if (code) {
        const codeRows = await selectPeopleByCode(db, code);
        const matches = codeRows.filter((row) => personRowMatchesName(row, name));
        if (matches.length > 1) return { outcome: "ambiguous", participant: null };
        if (matches.length === 1) return { outcome: "match", participant: participantContact(matches[0]) };
        const nameRows = (await selectPeopleByName(db, name, {
            equivalentMemberChineseName: true,
        })).filter(
            (row) => row.kind === "temporary_participant" || !isReservedTemporaryParticipantCode(row.code),
        );
        const codeExists = codeRows.length > 0;
        const nameExists = nameRows.length > 0;
        if (codeExists && nameExists) return { outcome: "different_people", participant: null };
        if (nameExists) return { outcome: "name_only", participant: null };
        if (codeExists) return { outcome: "code_only", participant: null };
        return { outcome: "not_found", participant: null };
    }

    const matches = (await selectPeopleByName(db, name, {
        equivalentMemberChineseName: true,
        dob: input.dob?.trim() ?? "",
    })).filter(
        (row) => row.kind === "temporary_participant" || !isReservedTemporaryParticipantCode(row.code),
    );
    if (matches.length > 1) return { outcome: "ambiguous", participant: null };
    if (matches.length === 1) return { outcome: "match", participant: participantContact(matches[0]) };
    const nameRows = (await selectPeopleByName(db, name, {
        equivalentMemberChineseName: true,
    })).filter(
        (row) => row.kind === "temporary_participant" || !isReservedTemporaryParticipantCode(row.code),
    );
    return nameRows.length > 0
        ? { outcome: "dob_mismatch", participant: null }
        : { outcome: "name_not_found", participant: null };
}

export async function resolvePublicMemberSessionAuthority(
    db: AppDb,
    tokenHash: string,
    now = new Date(),
): Promise<{
    participant: ResolvedActivityParticipant;
    name: string;
    memberCode: string;
    sessionAuthority: { tokenHash: string; kind: "client" | "child_member"; id: number; code: string };
} | null> {
    const row = await rawFirst<{
        kind: "client" | "child_member"; id: number; code: string; chinese_name: string;
        english_name: string | null; first_name: string | null; last_name: string | null;
        gender: string | null; tel: string | null; email: string | null;
    }>(db, {
        reasonKey: "public-activity-registration.atomic-write",
        sql: `SELECT session.participant_kind AS kind, participant.id, participant.code,
                participant.chinese_name, participant.english_name, participant.first_name,
                participant.last_name, participant.gender, participant.tel, participant.email
            FROM public_identity_sessions AS session
            JOIN (
                SELECT 'client' AS kind, id, client_code AS code, chinese_name, english_name, first_name, last_name, gender, tel, email, status FROM clients
                UNION ALL
                SELECT 'child_member' AS kind, id, child_code AS code, chinese_name, english_name, first_name, last_name, gender, tel, email, status FROM child_members
            ) AS participant ON participant.kind = session.participant_kind
                AND participant.id = session.participant_id AND participant.code = session.participant_code
            WHERE session.token_hash = ? AND session.revoked_at IS NULL AND session.expires_at > ?
                AND session.participant_kind IN ('client', 'child_member') AND participant.status = 'active'
            LIMIT 1`,
        params: [tokenHash, now.getTime()],
    });
    if (!row) return null;
    const name = row.chinese_name.trim() || [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.english_name?.trim() || "";
    if (!name) return null;
    return {
        participant: { kind: row.kind, id: row.id, code: row.code, gender: normalizeGender(row.gender), tel: contactValue(row.tel), email: contactValue(row.email) },
        name,
        memberCode: row.code,
        sessionAuthority: { tokenHash, kind: row.kind, id: row.id, code: row.code },
    };
}

export async function findNonMemberIdentity(
    db: AppDb,
    input: { name: string; dob: string },
): Promise<DobIdentityLookup> {
    const name = cleanTemporaryParticipantLegalName(input.name);
    const rows = await selectPeopleByName(db, name);
    const temporaryRows = rows.filter((row) => row.kind === "temporary_participant");
    const matches = temporaryRows.filter((row) => row.dob === input.dob.trim());
    if (matches.length > 1) return { outcome: "ambiguous", participant: null };
    if (matches.length === 1) return { outcome: "match", participant: participantContact(matches[0]) };
    return temporaryRows.length > 0
        ? { outcome: "dob_mismatch", participant: null }
        : { outcome: "name_not_found", participant: null };
}

export async function listPublicActivityOptions(db: AppDb): Promise<ActivityOption[]> {
    const today = todayBusinessDate();
    const rows = await rawAll<{
        id: number;
        name: string;
        held_at: string | null;
        integrity_enabled: number;
        integrity_deadline: string | null;
        questions: unknown;
        active_count: number;
        participant_limit: number;
        waitlisted_count: number;
        waitlist_limit: number;
    }>(db, {
        reasonKey: "public-activity-registration.atomic-write",
        sql: `SELECT activity.id, activity.name, activity.held_at,
                activity.integrity_enabled,
                datetime(date(activity.held_at), '-1 day', '+22 hours') AS integrity_deadline,
                activity.questions,
                (SELECT COUNT(*) FROM activity_registrations AS active_registration
                    WHERE active_registration.activity_id = activity.id
                      AND active_registration.registration_status = 'active') AS active_count,
                activity.expected_participants AS participant_limit,
                (SELECT COUNT(*) FROM activity_registrations AS waitlist_registration
                    WHERE waitlist_registration.activity_id = activity.id
                      AND waitlist_registration.registration_status = 'waitlisted'
                      AND ${eligibleWaitlistRegistrationSql("waitlist_registration")}) AS waitlisted_count,
                ${WAITLIST_LIMIT_SQL} AS waitlist_limit
            FROM activities AS activity
            WHERE activity.status = 'active' AND ${publicActivityAvailabilitySql()}
            ORDER BY activity.held_at IS NULL ASC, activity.held_at ASC, activity.id ASC`,
        params: [today],
    });
    return rows.flatMap((row) => {
        const result = validateActivityQuestionnaire(parseRawJson(row.questions));
        if (!result.ok) {
            console.error("Public activity questionnaire is invalid", { activityId: row.id });
            return [];
        }
        return [{
            id: row.id,
            name: row.name,
            heldAt: row.held_at,
            questions: result.value,
            integrityPolicy: {
                enabled: Boolean(row.integrity_enabled),
                cancellationDeadline: row.integrity_deadline,
            },
            capacity: {
                activeCount: Number(row.active_count),
                limit: Number(row.participant_limit),
                waitlistedCount: Number(row.waitlisted_count),
                waitlistLimit: Number(row.waitlist_limit),
            },
        }];
    });
}

export async function listPublicActivityCatalog(
    db: AppDb,
    origin: string,
): Promise<PublicActivityCatalogItem[]> {
    const activities = await listPublicActivityOptions(db);
    if (activities.length === 0) return [];

    const imageRows = await db
        .select({
            id: schema.activities.id,
            mimeType: schema.activityAssets.mimeType,
        })
        .from(schema.activities)
        .leftJoin(
            schema.activityAssets,
            eq(schema.activities.imageAssetId, schema.activityAssets.id),
        )
        .where(inArray(schema.activities.id, activities.map((activity) => activity.id)));
    const imageActivityIds = new Set(
        imageRows
            .filter((row) => row.mimeType?.startsWith("image/"))
            .map((row) => row.id),
    );

    return activities.map((activity) => ({
        id: activity.id,
        title: activity.name,
        image: imageActivityIds.has(activity.id)
            ? new URL(`/api/public/activities/${activity.id}/image`, origin).href
            : null,
        heldAt: activity.heldAt,
    }));
}

export async function getPublicActivityImage(
    db: AppDb,
    activityId: number,
): Promise<PublicActivityImage | null> {
    const activity = (await listPublicActivityOptions(db)).find((option) =>
        option.id === activityId
    );
    if (!activity) return null;

    const [asset] = await db
        .select({
            r2Key: schema.activityAssets.r2Key,
            originalName: schema.activityAssets.originalName,
            mimeType: schema.activityAssets.mimeType,
        })
        .from(schema.activities)
        .innerJoin(
            schema.activityAssets,
            eq(schema.activities.imageAssetId, schema.activityAssets.id),
        )
        .where(and(
            eq(schema.activities.id, activityId),
            eq(schema.activities.status, "active"),
        ))
        .limit(1);

    if (!asset?.mimeType?.startsWith("image/")) return null;
    return {
        r2Key: asset.r2Key,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
    };
}

export async function getPublicActivityCapacitySummary(
    db: AppDb,
    activityId: number,
): Promise<ActivityCapacitySummary | null> {
    const row = await rawFirst<{
        active_count: number;
        participant_limit: number;
        waitlisted_count: number;
        waitlist_limit: number;
    }>(db, {
        reasonKey: "public-activity-registration.atomic-write",
        sql: `SELECT
                (SELECT COUNT(*) FROM activity_registrations AS active_registration
                    WHERE active_registration.activity_id = activity.id
                      AND active_registration.registration_status = 'active') AS active_count,
                activity.expected_participants AS participant_limit,
                (SELECT COUNT(*) FROM activity_registrations AS waitlist_registration
                    WHERE waitlist_registration.activity_id = activity.id
                      AND waitlist_registration.registration_status = 'waitlisted'
                      AND ${eligibleWaitlistRegistrationSql("waitlist_registration")}) AS waitlisted_count,
                ${WAITLIST_LIMIT_SQL} AS waitlist_limit
            FROM activities AS activity
            WHERE activity.id = ? AND activity.status = 'active'
              AND ${publicActivityAvailabilitySql()}`,
        params: [activityId, todayBusinessDate()],
    });
    return row
        ? {
            activeCount: Number(row.active_count),
            limit: Number(row.participant_limit),
            waitlistedCount: Number(row.waitlisted_count),
            waitlistLimit: Number(row.waitlist_limit),
        }
        : null;
}

export async function getPublicActivityQuestionnaire(
    db: AppDb,
    activityId: number,
): Promise<ActivityQuestionnaire | null> {
    const today = todayBusinessDate();
    const [row] = await db.select({
        id: schema.activities.id,
        questions: schema.activities.questions,
    }).from(schema.activities).where(and(
        eq(schema.activities.id, activityId),
        eq(schema.activities.status, "active"),
        or(
            isNull(schema.activities.heldAt),
            sql<boolean>`substr(${schema.activities.heldAt}, 1, 10) >= ${today}`,
        ),
    )).limit(1);
    if (!row) return null;
    const result = validateActivityQuestionnaire(row.questions);
    return result.ok ? result.value : null;
}

async function requirePublicActivity(
    db: AppDb,
    activityId: number,
    expectedQuestions?: ActivityQuestionnaire,
): Promise<boolean> {
    const questions = await getPublicActivityQuestionnaire(db, activityId);
    if (!questions) return false;
    return !expectedQuestions || JSON.stringify(questions) === JSON.stringify(expectedQuestions);
}

type PublicActivityRegistrationPolicy = {
    integrityEnabled: boolean;
    integrityPolicy: ActivityIntegrityPolicy;
};

async function getPublicActivityRegistrationPolicy(
    db: AppDb,
    activityId: number,
    expectedQuestions: ActivityQuestionnaire,
): Promise<PublicActivityRegistrationPolicy | null> {
    const row = await rawFirst<{
        integrity_enabled: number;
        integrity_deadline: string | null;
    }>(db, {
        reasonKey: "public-activity-registration.atomic-write",
        sql: `SELECT activity.integrity_enabled,
                datetime(date(activity.held_at), '-1 day', '+22 hours') AS integrity_deadline
            FROM activities AS activity
            WHERE activity.id = ? AND activity.status = 'active'
              AND ${publicActivityAvailabilitySql()}
              AND activity.questions = ?`,
        params: [activityId, todayBusinessDate(), JSON.stringify(expectedQuestions)],
    });
    return row
        ? {
            integrityEnabled: Boolean(row.integrity_enabled),
            integrityPolicy: {
                enabled: Boolean(row.integrity_enabled),
                cancellationDeadline: row.integrity_deadline,
            },
        }
        : null;
}

async function findStoredActivityRegistration(
    db: AppDb,
    activityId: number,
    clientCode: string,
    participant?: ResolvedActivityParticipant,
): Promise<StoredActivityRegistration | null> {
    const [row] = await db.select({
        id: schema.activityRegistrations.id,
        clientId: schema.activityRegistrations.clientId,
        childMemberId: schema.activityRegistrations.childMemberId,
        temporaryParticipantId: schema.activityRegistrations.temporaryParticipantId,
        registrationStatus: schema.activityRegistrations.registrationStatus,
        registeredAt: schema.activityRegistrations.registeredAt,
        waitlistedAt: schema.activityRegistrations.waitlistedAt,
        integrityLateCancelledAt: schema.activityRegistrations.integrityLateCancelledAt,
        answers: schema.activityRegistrations.answers,
    }).from(schema.activityRegistrations).where(and(
        eq(schema.activityRegistrations.activityId, activityId),
        eq(schema.activityRegistrations.clientCode, clientCode),
    )).limit(1);
    if (!row) return null;
    if (participant && !storedRegistrationMatchesParticipant(row, participant)) return null;
    return row;
}

async function hasActiveAttendance(db: AppDb, activityId: number, participant: ResolvedActivityParticipant): Promise<boolean> {
    const source = participantRegistrationSource(participant);
    const row = await rawFirst<{ id: number }>(db, {
        reasonKey: "public-activity-registration.atomic-write",
        sql: `SELECT attendance.id FROM activity_attendance AS attendance
            WHERE attendance.activity_id = ? AND attendance.attendance_status = 'active'
              AND attendance.client_code = ? AND ${source.registrationPredicate.replaceAll("registration.", "attendance.")}
            LIMIT 1`,
        params: [activityId, participant.code, ...source.registrationParams],
    });
    return Boolean(row);
}

function safeStoredAnswers(value: unknown, questionnaire: ActivityQuestionnaire): ActivityRegistrationAnswers {
    return parseStoredActivityRegistrationAnswers(value, questionnaire) ?? emptyAnswers(questionnaire);
}

/** Single producer seam shared by SSR load and the registrationStatus action. */
export async function createRegistrationSnapshot(
    db: AppDb,
    input: {
        activityId: number; participant: ResolvedActivityParticipant; questionnaire: ActivityQuestionnaire; questionnaireVersion: string;
        integrityNow?: Date;
        sessionAuthority?: { tokenHash: string; kind: ParticipantKind; id: number; code: string | null };
        expectedActivity?: { name: string; heldAt: string | null };
        expectedMember?: { name: string; memberCode: string };
    },
): Promise<RegistrationSnapshot> {
    try {
        let integritySummary: ActivityIntegritySummary | null = null;
        try {
            integritySummary = await getPublicActivityIntegritySummary(
                db,
                input.participant,
                input.integrityNow,
            );
        } catch {
            integritySummary = null;
        }
        const first = await readRegistrationSnapshotPass(db, input);
        const second = await readRegistrationSnapshotPass(db, input);
        const classification = classifyRegistrationSnapshotPasses(first, second, input);
        if (classification) return classification;
        const registration = second.registration[0] ?? null;
        if (registration && !storedRegistrationMatchesParticipant({
            id: registration.id,
            clientId: registration.client_id,
            childMemberId: registration.child_member_id,
            temporaryParticipantId: registration.temporary_participant_id,
            registrationStatus: registration.registration_status,
            registeredAt: registration.registered_at,
            waitlistedAt: registration.waitlisted_at,
            integrityLateCancelledAt: registration.integrity_late_cancelled_at,
            answers: registration.answers,
        }, input.participant)) return { status: "unknown", error: "service_unavailable" };
        if (second.attendance.some((row) => !attendanceRowMatchesParticipant(row, input.participant))) {
            return { status: "unknown", error: "service_unavailable" };
        }
        const capacity = second.activity!.capacity;
        const integrityPolicy = second.activity!.integrityPolicy;
        if (!registration || registration.registration_status === "cancelled") {
            if (second.attendance.some((row) => row.attendance_status === "active")) return { status: "unknown", error: "service_unavailable" };
            return { status: "not_registered", questionnaireVersion: input.questionnaireVersion, answers: null, answersVersion: null, attended: false, capacity, integritySummary, integrityPolicy };
        }
        const parsed = parseStoredActivityRegistrationAnswers(registration.answers, input.questionnaire);
        const attended = registration.registration_status === "active" &&
            second.attendance.some((row) => row.attendance_status === "active");
        const status = registration.registration_status === "active" ? "registered" : "waitlisted";
        if (status === "waitlisted" && (!registration.waitlisted_at || !registration.queue_position)) {
            return { status: "unknown", error: "service_unavailable" };
        }
        if (!parsed) {
            const answers = emptyAnswers(input.questionnaire);
            const answersVersion = await activityAnswersVersion(
                input.questionnaire,
                answers.answers.map((answer) => answer.value),
            );
            return status === "waitlisted"
                ? {
                    status,
                    questionnaireVersion: input.questionnaireVersion,
                    answers,
                    answersVersion,
                    attended: false,
                    capacity,
                    integritySummary,
                    integrityPolicy,
                    queuePosition: registration.queue_position!,
                    questionnaireChanged: true,
                }
                : {
                    status,
                    questionnaireVersion: input.questionnaireVersion,
                    answers,
                    answersVersion,
                    attended,
                    capacity,
                    integritySummary,
                    integrityPolicy,
                    questionnaireChanged: true,
                };
        }
        const answersVersion = await activityAnswersVersion(
            input.questionnaire,
            parsed.answers.map((answer) => answer.value),
        );
        return status === "waitlisted"
            ? {
                status,
                questionnaireVersion: input.questionnaireVersion,
                answers: parsed,
                answersVersion,
                attended: false,
                capacity,
                integritySummary,
                integrityPolicy,
                queuePosition: registration.queue_position!,
            }
            : {
                status,
                questionnaireVersion: input.questionnaireVersion,
                answers: parsed,
                answersVersion,
                attended,
                capacity,
                integritySummary,
                integrityPolicy,
            };
    } catch {
        return { status: "unknown", error: "service_unavailable" };
    }
}

type SnapshotRegistrationRow = {
    id: number; client_id: number | null; child_member_id: number | null;
    temporary_participant_id: number | null; registration_status: "active" | "waitlisted" | "cancelled";
    registered_at: string | null; waitlisted_at: string | null; queue_position: number | null;
    integrity_late_cancelled_at: string | null;
    answers: unknown;
};
type SnapshotAttendanceRow = {
    id: number; client_id: number | null; child_member_id: number | null;
    temporary_participant_id: number | null; attendance_status: string;
};
type RegistrationSnapshotPass = {
    activity: {
        id: number;
        name: string;
        status: string;
        held_at: string | null;
        questions: unknown;
        capacity: ActivityCapacitySummary;
        integrityPolicy: ActivityIntegrityPolicy;
    } | null;
    participant: { id: number; code: string; status: string; chinese_name: string | null; english_name: string | null; first_name: string | null; last_name: string | null; gender: string | null; tel: string | null; email: string | null } | null;
    session: { token_hash: string; participant_kind: string; participant_id: number; participant_code: string | null; expires_at: number; revoked_at: string | null } | null;
    registration: SnapshotRegistrationRow[];
    attendance: SnapshotAttendanceRow[];
};

async function readRegistrationSnapshotPass(
    db: AppDb,
    input: { activityId: number; participant: ResolvedActivityParticipant; sessionAuthority?: { tokenHash: string } },
): Promise<RegistrationSnapshotPass> {
    const source = participantRegistrationSource(input.participant);
    const displayColumns = input.participant.kind === "temporary_participant"
        ? "participant.chinese_name, NULL AS english_name, participant.first_name, participant.last_name, participant.gender, participant.tel, participant.email"
        : "participant.chinese_name, participant.english_name, participant.first_name, participant.last_name, participant.gender, participant.tel, participant.email";
    type JoinedRow = {
        activity_id: number | null; activity_name: string | null; activity_status: string | null; held_at: string | null;
        integrity_enabled: number | null; integrity_deadline: string | null; questions: unknown;
        active_count: number | null; participant_limit: number | null; waitlisted_count: number | null; waitlist_limit: number | null;
        participant_id: number | null; participant_code: string | null; participant_status: string | null; chinese_name: string | null; english_name: string | null; first_name: string | null; last_name: string | null; gender: string | null; tel: string | null; email: string | null;
        session_token_hash: string | null; session_participant_kind: string | null; session_participant_id: number | null; session_participant_code: string | null; session_expires_at: number | null; session_revoked_at: string | null;
        registration_id: number | null; registration_client_id: number | null; registration_child_member_id: number | null;
        registration_temporary_participant_id: number | null; registration_status: "active" | "waitlisted" | "cancelled" | null;
        registered_at: string | null; waitlisted_at: string | null; queue_position: number | null;
        integrity_late_cancelled_at: string | null; answers: unknown;
        attendance_id: number | null; attendance_client_id: number | null; attendance_child_member_id: number | null;
        attendance_temporary_participant_id: number | null; attendance_status: string | null;
    };
    const rows = await rawAll<JoinedRow>(db, {
        reasonKey: "public-activity-registration.atomic-write",
        sql: `SELECT activity.id AS activity_id, activity.name AS activity_name, activity.status AS activity_status,
                activity.held_at, activity.integrity_enabled,
                datetime(date(activity.held_at), '-1 day', '+22 hours') AS integrity_deadline,
                activity.questions,
                (SELECT COUNT(*) FROM activity_registrations AS active_registration
                    WHERE active_registration.activity_id = activity.id
                      AND active_registration.registration_status = 'active') AS active_count,
                activity.expected_participants AS participant_limit,
                (SELECT COUNT(*) FROM activity_registrations AS waitlist_registration
                    WHERE waitlist_registration.activity_id = activity.id
                      AND waitlist_registration.registration_status = 'waitlisted'
                      AND ${eligibleWaitlistRegistrationSql("waitlist_registration")}) AS waitlisted_count,
                ${WAITLIST_LIMIT_SQL} AS waitlist_limit,
                participant.id AS participant_id, ${source.codeExpression} AS participant_code, participant.status AS participant_status,
                ${displayColumns},
                identity_session.token_hash AS session_token_hash, identity_session.participant_kind AS session_participant_kind,
                identity_session.participant_id AS session_participant_id, identity_session.participant_code AS session_participant_code,
                identity_session.expires_at AS session_expires_at, identity_session.revoked_at AS session_revoked_at,
                registration.id AS registration_id, registration.client_id AS registration_client_id,
                registration.child_member_id AS registration_child_member_id,
                registration.temporary_participant_id AS registration_temporary_participant_id,
                registration.registration_status, registration.registered_at, registration.waitlisted_at,
                registration.integrity_late_cancelled_at,
                CASE WHEN registration.registration_status = 'waitlisted' THEN (
                    SELECT COUNT(*)
                    FROM activity_registrations AS queue_registration
                    WHERE queue_registration.activity_id = registration.activity_id
                      AND queue_registration.registration_status = 'waitlisted'
                      AND ${eligibleWaitlistRegistrationSql("queue_registration")}
                      AND (queue_registration.waitlisted_at < registration.waitlisted_at
                        OR (queue_registration.waitlisted_at = registration.waitlisted_at
                          AND queue_registration.id <= registration.id))
                ) ELSE NULL END AS queue_position,
                registration.answers,
                attendance.id AS attendance_id, attendance.client_id AS attendance_client_id,
                attendance.child_member_id AS attendance_child_member_id,
                attendance.temporary_participant_id AS attendance_temporary_participant_id,
                attendance.attendance_status
            FROM (SELECT 1) AS seed
            LEFT JOIN activities AS activity ON activity.id = ?
            LEFT JOIN ${source.tableName} AS participant ON participant.id = ?
            LEFT JOIN public_identity_sessions AS identity_session ON identity_session.token_hash = ?
            LEFT JOIN activity_registrations AS registration ON registration.activity_id = ? AND registration.client_code = ?
            LEFT JOIN activity_attendance AS attendance ON attendance.activity_id = ? AND attendance.client_code = ?
            ORDER BY registration.id, attendance.id`,
        params: [input.activityId, input.participant.id, input.sessionAuthority?.tokenHash ?? "", input.activityId, input.participant.code, input.activityId, input.participant.code],
    });
    const first = rows[0];
    const activity = first?.activity_id == null ? null : {
        id: first.activity_id,
        name: first.activity_name!,
        status: first.activity_status!,
        held_at: first.held_at,
        questions: parseRawJson(first.questions),
        integrityPolicy: {
            enabled: Boolean(first.integrity_enabled),
            cancellationDeadline: first.integrity_deadline,
        },
        capacity: {
            activeCount: Number(first.active_count),
            limit: Number(first.participant_limit),
            waitlistedCount: Number(first.waitlisted_count),
            waitlistLimit: Number(first.waitlist_limit),
        },
    };
    const participant = first?.participant_id == null ? null : { id: first.participant_id, code: first.participant_code!, status: first.participant_status!, chinese_name: first.chinese_name, english_name: first.english_name, first_name: first.first_name, last_name: first.last_name, gender: first.gender, tel: first.tel, email: first.email };
    const session = first?.session_token_hash == null ? null : { token_hash: first.session_token_hash, participant_kind: first.session_participant_kind!, participant_id: first.session_participant_id!, participant_code: first.session_participant_code, expires_at: first.session_expires_at!, revoked_at: first.session_revoked_at };
    const registration = first?.registration_id == null ? [] : [{
        id: first.registration_id, client_id: first.registration_client_id, child_member_id: first.registration_child_member_id,
        temporary_participant_id: first.registration_temporary_participant_id,
        registration_status: first.registration_status!,
        registered_at: first.registered_at,
        waitlisted_at: first.waitlisted_at,
        integrity_late_cancelled_at: first.integrity_late_cancelled_at,
        queue_position: first.queue_position === null ? null : Number(first.queue_position),
        answers: parseRawJson(first.answers),
    }];
    const attendance = rows.filter((row, index) => row.attendance_id != null && rows.findIndex((candidate) => candidate.attendance_id === row.attendance_id) === index).map((row) => ({
        id: row.attendance_id!, client_id: row.attendance_client_id, child_member_id: row.attendance_child_member_id,
        temporary_participant_id: row.attendance_temporary_participant_id, attendance_status: row.attendance_status!,
    }));
    return { activity, participant, session, registration, attendance };
}

function parseRawJson(value: unknown): unknown {
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return value; }
}

function classifyRegistrationSnapshotPasses(
    first: RegistrationSnapshotPass,
    second: RegistrationSnapshotPass,
    input: { participant: ResolvedActivityParticipant; questionnaire: ActivityQuestionnaire; sessionAuthority?: { tokenHash: string; kind: ParticipantKind; id: number; code: string | null }; expectedActivity?: { name: string; heldAt: string | null }; expectedMember?: { name: string; memberCode: string } },
): RegistrationSnapshot | null {
    if (!second.activity || second.activity.status !== "active" ||
        (second.activity.held_at !== null && second.activity.held_at.slice(0, 10) < todayBusinessDate())) {
        return { status: "unknown", error: "activity_unavailable" };
    }
    if (!first.activity || first.activity.status !== "active") return { status: "unknown", error: "activity_unavailable" };
    if (input.expectedActivity && (first.activity.name !== input.expectedActivity.name || first.activity.held_at !== input.expectedActivity.heldAt || second.activity.name !== input.expectedActivity.name || second.activity.held_at !== input.expectedActivity.heldAt)) return { status: "unknown", error: "activity_unavailable" };
    if (JSON.stringify(first.activity.questions) !== JSON.stringify(second.activity.questions) ||
        JSON.stringify(second.activity.questions) !== JSON.stringify(input.questionnaire)) {
        return { status: "unknown", error: "questionnaire_changed" };
    }
    if (!first.participant || first.participant.status !== "active" || first.participant.code !== input.participant.code ||
        !second.participant || second.participant.status !== "active" || second.participant.code !== input.participant.code ||
        JSON.stringify(first.participant) !== JSON.stringify(second.participant)) {
        return { status: "unknown", error: "identity_invalidated" };
    }
    if (input.expectedMember) {
        const name = first.participant.chinese_name?.trim() || [first.participant.first_name, first.participant.last_name].filter(Boolean).join(" ").trim() || first.participant.english_name?.trim() || "";
        if (name !== input.expectedMember.name || first.participant.code !== input.expectedMember.memberCode || first.participant.gender !== input.participant.gender || first.participant.tel !== input.participant.tel || first.participant.email !== input.participant.email) return { status: "unknown", error: "identity_invalidated" };
    }
    if (input.sessionAuthority) {
        const session = second.session;
        if (!session || session.token_hash !== input.sessionAuthority.tokenHash || session.participant_kind !== input.sessionAuthority.kind || session.participant_id !== input.sessionAuthority.id || session.participant_code !== input.sessionAuthority.code || session.revoked_at !== null || session.expires_at <= Date.now() || JSON.stringify(first.session) !== JSON.stringify(second.session)) return { status: "unknown", error: "identity_invalidated" };
    }
    if (JSON.stringify(first) !== JSON.stringify(second)) return { status: "unknown", error: "service_unavailable" };
    if (second.registration.length > 1) return { status: "unknown", error: "service_unavailable" };
    return null;
}

function attendanceRowMatchesParticipant(row: SnapshotAttendanceRow, participant: ResolvedActivityParticipant): boolean {
    return participant.kind === "client"
        ? row.client_id === participant.id && row.child_member_id === null && row.temporary_participant_id === null
        : participant.kind === "child_member"
        ? row.client_id === null && row.child_member_id === participant.id && row.temporary_participant_id === null
        : row.client_id === null && row.child_member_id === null && row.temporary_participant_id === participant.id;
}

export async function updatePublicRegistration(
    db: AppDb,
    input: { activityId: number; participant: ResolvedActivityParticipant; questionnaire: ActivityQuestionnaire; questionnaireVersion: string; answers: ActivityRegistrationAnswers; expectedAnswersVersion: string },
): Promise<{ answers: ActivityRegistrationAnswers; answersVersion: string } | "not_registered" | "conflict" | "unavailable"> {
    const existing = await findStoredActivityRegistration(db, input.activityId, input.participant.code, input.participant);
    if (
        !existing ||
        (existing.registrationStatus !== "active" && existing.registrationStatus !== "waitlisted")
    ) return "not_registered";
    const current = safeStoredAnswers(existing.answers, input.questionnaire);
    const currentVersion = await activityAnswersVersion(input.questionnaire, current.answers.map((answer) => answer.value));
    if (currentVersion !== input.expectedAnswersVersion) return "conflict";
    const normalized = parseSubmissionActivityRegistrationAnswers(input.answers, input.questionnaire);
    if (!normalized) throw new Error("invalid_activity_registration_answers");
    const nextVersion = await activityAnswersVersion(input.questionnaire, normalized.answers.map((answer) => answer.value));
    const source = participantRegistrationSource(input.participant);
    const storedAnswersSnapshot = JSON.stringify(existing.answers);
    const result = await rawRun(db, {
        reasonKey: "public-activity-registration.atomic-write",
        sql: `UPDATE activity_registrations AS registration SET answers = ?, registration_updated_at = ?, updated_at = ?
            WHERE registration.id = ? AND registration.registration_status IN ('active', 'waitlisted')
              AND registration.activity_id = ? AND registration.client_code = ?
              AND ${source.registrationPredicate}
              AND registration.answers = ?
              AND EXISTS (SELECT 1 FROM activities AS activity WHERE activity.id = ? AND activity.status = 'active' AND ${publicActivityAvailabilitySql()} AND activity.questions = ?)
              AND EXISTS (SELECT 1 FROM ${source.tableName} AS participant WHERE ${source.activePredicate})`,
        params: [JSON.stringify(normalized), nowSqlDateTime(), nowSqlDateTime(), existing.id, input.activityId, input.participant.code, ...source.registrationParams, storedAnswersSnapshot, input.activityId, todayBusinessDate(), JSON.stringify(input.questionnaire), ...source.activeParams],
    });
    if (Number(result.meta.changes ?? 0) !== 1) {
        const participantActive = await isResolvedParticipantActive(db, input.participant);
        if (!participantActive || !await requirePublicActivity(db, input.activityId, input.questionnaire)) return "unavailable";
        const latest = await findStoredActivityRegistration(db, input.activityId, input.participant.code, input.participant);
        if (
            !latest ||
            (latest.registrationStatus !== "active" && latest.registrationStatus !== "waitlisted")
        ) return "not_registered";
        const latestAnswers = safeStoredAnswers(latest.answers, input.questionnaire);
        const latestVersion = await activityAnswersVersion(input.questionnaire, latestAnswers.answers.map((answer) => answer.value));
        return latestVersion === input.expectedAnswersVersion ? "unavailable" : "conflict";
    }
    return { answers: normalized, answersVersion: nextVersion };
}

export async function cancelPublicRegistration(
    db: AppDb,
    input: { activityId: number; participant: ResolvedActivityParticipant; questionnaire: ActivityQuestionnaire; now?: Date },
): Promise<"cancelled" | "not_registered" | "attended" | "unavailable"> {
    const existing = await findStoredActivityRegistration(db, input.activityId, input.participant.code, input.participant);
    if (
        !existing ||
        (existing.registrationStatus !== "active" && existing.registrationStatus !== "waitlisted")
    ) return "not_registered";
    const source = participantRegistrationSource(input.participant);
    const timestamp = nowSqlDateTime(input.now);
    const policy = await getPublicActivityRegistrationPolicy(
        db,
        input.activityId,
        input.questionnaire,
    );
    if (!policy) return "unavailable";
    if (existing.registrationStatus === "waitlisted") {
        const [deleted] = await rawBatch(db, {
            reasonKey: "public-activity-registration.atomic-write",
            statements: [{
                sql: `DELETE FROM activity_registrations AS registration
                    WHERE registration.id = ?
                      AND registration.registration_status = 'waitlisted'
                      AND registration.activity_id = ? AND registration.client_code = ?
                      AND ${source.registrationPredicate}
                      AND EXISTS (
                        SELECT 1 FROM activities AS activity
                        WHERE activity.id = ? AND activity.status = 'active'
                          AND ${publicActivityAvailabilitySql()}
                          AND activity.questions = ?
                      )
                      AND EXISTS (
                        SELECT 1 FROM ${source.tableName} AS participant
                        WHERE ${source.activePredicate}
                      )`,
                params: [
                    existing.id,
                    input.activityId,
                    input.participant.code,
                    ...source.registrationParams,
                    input.activityId,
                    todayBusinessDate(),
                    JSON.stringify(input.questionnaire),
                    ...source.activeParams,
                ],
            }],
        });
        if (Number(deleted.meta.changes ?? 0) === 1) return "cancelled";
    } else {
        const cancellationGuard = `EXISTS (
            SELECT 1 FROM activity_registrations AS cancelled_registration
            WHERE cancelled_registration.id = ?
              AND cancelled_registration.registration_status = 'cancelled'
              AND cancelled_registration.registration_updated_at = ?
        )`;
        const markStatement: ActivityLifecycleStatement = {
            sql: `UPDATE activity_registrations AS registration
                SET registration_status = 'cancelled',
                    integrity_late_cancelled_at = CASE
                      WHEN ? = 1 AND EXISTS (
                        SELECT 1 FROM activities AS integrity_activity
                        WHERE integrity_activity.id = registration.activity_id
                          AND integrity_activity.integrity_enabled = 1
                          AND ? >= datetime(date(integrity_activity.held_at), '-1 day', '+22 hours')
                      ) THEN COALESCE(registration.integrity_late_cancelled_at, ?)
                      ELSE registration.integrity_late_cancelled_at
                    END,
                    registration_updated_at = ?, updated_at = ?
                WHERE registration.id = ?
                  AND registration.registration_status = 'active'
                  AND registration.activity_id = ? AND registration.client_code = ?
                  AND ${source.registrationPredicate}
                  AND EXISTS (
                    SELECT 1 FROM activities AS activity
                    WHERE activity.id = ? AND activity.status = 'active'
                      AND ${publicActivityAvailabilitySql()}
                      AND activity.questions = ?
                      AND activity.integrity_enabled = ?
                  )
                  AND EXISTS (
                    SELECT 1 FROM ${source.tableName} AS participant
                    WHERE ${source.activePredicate}
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM activity_attendance AS attendance
                    WHERE attendance.activity_id = ?
                      AND attendance.attendance_status = 'active'
                      AND attendance.client_code = ?
                      AND ${source.registrationPredicate.replaceAll("registration.", "attendance.")}
                  )`,
            params: [
                policy.integrityEnabled ? 1 : 0,
                timestamp,
                timestamp,
                timestamp,
                timestamp,
                existing.id,
                input.activityId,
                input.participant.code,
                ...source.registrationParams,
                input.activityId,
                todayBusinessDate(),
                JSON.stringify(input.questionnaire),
                policy.integrityEnabled ? 1 : 0,
                ...source.activeParams,
                input.activityId,
                input.participant.code,
                ...source.registrationParams,
            ],
        };
        const deleteEarlyCancellation: ActivityLifecycleStatement = {
            sql: `DELETE FROM activity_registrations
                WHERE id = ? AND registration_status = 'cancelled'
                  AND registration_updated_at = ?
                  AND integrity_late_cancelled_at IS NULL`,
            params: [existing.id, timestamp],
        };
        const lifecycleStatements: ActivityLifecycleStatement[] = [markStatement];
        if (policy.integrityEnabled) {
            lifecycleStatements.push(
                {
                    sql: `${INTEGRITY_CLOCK_CTE}
                        UPDATE activity_registrations AS registration
                        SET registration_status = 'cancelled', registration_updated_at = ?, updated_at = ?
                        WHERE registration.registration_status = 'waitlisted'
                          AND ${source.registrationPredicate}
                          AND EXISTS (
                            SELECT 1 FROM activities AS queued_activity
                            WHERE queued_activity.id = registration.activity_id
                              AND queued_activity.integrity_enabled = 1
                          )
                          AND ${integrityLossCountForParticipantSql(source)} >= 3
                          AND ${cancellationGuard}`,
                    params: [
                        ...integrityClockParams(timestamp),
                        timestamp,
                        timestamp,
                        ...source.registrationParams,
                        ...source.registrationParams,
                        existing.id,
                        timestamp,
                    ],
                },
                {
                    sql: `${INTEGRITY_CLOCK_CTE}
                        UPDATE activity_registrations AS registration
                        SET registration_status = 'cancelled', registration_updated_at = ?, updated_at = ?
                        WHERE registration.activity_id = ?
                          AND registration.registration_status = 'waitlisted'
                          AND (
                            NOT (${eligibleWaitlistRegistrationSql("registration")})
                            OR ${integrityLossCountForRegistrationSql("registration")} >= 3
                          )
                          AND ${cancellationGuard}`,
                    params: [
                        ...integrityClockParams(timestamp),
                        timestamp,
                        timestamp,
                        input.activityId,
                        existing.id,
                        timestamp,
                    ],
                },
                {
                    sql: `${INTEGRITY_CLOCK_CTE}
                        UPDATE activity_registrations AS registration
                        SET registration_status = 'active', registered_at = ?,
                            registration_updated_at = ?, updated_at = ?
                        WHERE registration.id = (
                            SELECT candidate.id
                            FROM activity_registrations AS candidate
                            WHERE candidate.activity_id = ?
                              AND candidate.registration_status = 'waitlisted'
                              AND ${eligibleWaitlistRegistrationSql("candidate")}
                              AND ${integrityLossCountForRegistrationSql("candidate")} < 3
                            ORDER BY candidate.waitlisted_at ASC, candidate.id ASC
                            LIMIT 1
                        )
                          AND EXISTS (
                            SELECT 1 FROM activities AS activity
                            WHERE activity.id = ? AND activity.status = 'active'
                              AND ${publicActivityAvailabilitySql()}
                              AND activity.questions = ?
                              AND activity.integrity_enabled = 1
                              AND (SELECT COUNT(*) FROM activity_registrations AS active_registration
                                WHERE active_registration.activity_id = activity.id
                                  AND active_registration.registration_status = 'active')
                                < activity.expected_participants
                          )
                          AND ${cancellationGuard}`,
                    params: [
                        ...integrityClockParams(timestamp),
                        timestamp,
                        timestamp,
                        timestamp,
                        input.activityId,
                        input.activityId,
                        todayBusinessDate(),
                        JSON.stringify(input.questionnaire),
                        existing.id,
                        timestamp,
                    ],
                },
            );
        } else {
            lifecycleStatements.push(
                {
                    sql: `UPDATE activity_registrations AS registration
                        SET registration_status = 'cancelled', registration_updated_at = ?, updated_at = ?
                        WHERE registration.activity_id = ?
                          AND registration.registration_status = 'waitlisted'
                          AND NOT (${eligibleWaitlistRegistrationSql("registration")})
                          AND ${cancellationGuard}`,
                    params: [timestamp, timestamp, input.activityId, existing.id, timestamp],
                },
                {
                    sql: `UPDATE activity_registrations AS registration
                        SET registration_status = 'active', registered_at = ?,
                            registration_updated_at = ?, updated_at = ?
                        WHERE registration.id = (
                            SELECT candidate.id FROM activity_registrations AS candidate
                            WHERE candidate.activity_id = ?
                              AND candidate.registration_status = 'waitlisted'
                              AND ${eligibleWaitlistRegistrationSql("candidate")}
                            ORDER BY candidate.waitlisted_at ASC, candidate.id ASC
                            LIMIT 1
                        )
                          AND EXISTS (
                            SELECT 1 FROM activities AS activity
                            WHERE activity.id = ? AND activity.status = 'active'
                              AND ${publicActivityAvailabilitySql()}
                              AND activity.questions = ?
                              AND activity.integrity_enabled = 0
                              AND (SELECT COUNT(*) FROM activity_registrations AS active_registration
                                WHERE active_registration.activity_id = activity.id
                                  AND active_registration.registration_status = 'active') < activity.expected_participants
                          )
                          AND ${cancellationGuard}`,
                    params: [timestamp, timestamp, timestamp, input.activityId, input.activityId, todayBusinessDate(), JSON.stringify(input.questionnaire), existing.id, timestamp],
                },
            );
        }
        lifecycleStatements.push(deleteEarlyCancellation);
        let batch: D1Result[];
        try {
            batch = await rawBatch(db, {
                reasonKey: "public-activity-registration.atomic-write",
                statements: lifecycleStatements,
            });
        } catch (cause) {
            if (!policy.integrityEnabled) throw cause;
            batch = await rawBatch(db, {
                reasonKey: "public-activity-registration.atomic-write",
                statements: [markStatement, deleteEarlyCancellation],
            });
        }
        const marked = batch[0];
        if (Number(marked.meta.changes ?? 0) === 1) return "cancelled";
    }
    if (!await isResolvedParticipantActive(db, input.participant)) return "unavailable";
    if (!await requirePublicActivity(db, input.activityId, input.questionnaire)) return "unavailable";
    const latest = await findStoredActivityRegistration(db, input.activityId, input.participant.code, input.participant);
    if (
        !latest ||
        (latest.registrationStatus !== "active" && latest.registrationStatus !== "waitlisted")
    ) return "not_registered";
    return latest.registrationStatus === "active" &&
            await hasActiveAttendance(db, input.activityId, input.participant)
        ? "attended"
        : "unavailable";
}

function storedRegistrationMatchesParticipant(
    row: StoredActivityRegistration,
    participant: ResolvedActivityParticipant,
): boolean {
    if (participant.kind === "client") {
        return row.clientId === participant.id &&
            row.childMemberId === null &&
            row.temporaryParticipantId === null;
    }
    if (participant.kind === "child_member") {
        return row.clientId === null &&
            row.childMemberId === participant.id &&
            row.temporaryParticipantId === null;
    }
    return row.clientId === null &&
        row.childMemberId === null &&
        row.temporaryParticipantId === participant.id;
}

async function isResolvedParticipantActive(
    db: AppDb,
    participant: ResolvedActivityParticipant,
): Promise<boolean> {
    const source = participantRegistrationSource(participant);
    const row = await rawFirst<{ id: number }>(db, {
        reasonKey: "public-activity-registration.atomic-write",
        sql: `SELECT participant.id
            FROM ${source.tableName} AS participant
            WHERE ${source.activePredicate}
            LIMIT 1`,
        params: source.activeParams,
    });
    return Boolean(row);
}

async function assertRegistrationPrerequisites(
    db: AppDb,
    input: {
        activityId: number;
        participant: ResolvedActivityParticipant;
        questions: ActivityQuestionnaire;
    },
): Promise<void> {
    if (!await requirePublicActivity(db, input.activityId, input.questions)) {
        throw new Error("activity_unavailable");
    }
    if (!await isResolvedParticipantActive(db, input.participant)) {
        throw new ActivityRegistrationRejectedError("participant_inactive");
    }
}

type RegistrationClassificationPlan = {
    statements: ActivityLifecycleStatement[];
    activeIndexes: number[];
    waitlistIndexes: number[];
};

function registrationClassificationStatements(input: {
    activityId: number;
    participant: ResolvedActivityParticipant;
    questions: ActivityQuestionnaire;
    answers: ActivityRegistrationAnswers;
    timestamp: string;
    integrityEnabled: boolean;
}, sourceOverride?: ParticipantRegistrationSource): RegistrationClassificationPlan {
    const source = sourceOverride ?? participantRegistrationSource(input.participant);
    const activityGuard = `activity.id = ?
        AND activity.status = 'active'
        AND ${publicActivityAvailabilitySql()}
        AND activity.questions = ?
        AND activity.integrity_enabled = ?`;
    const activityParams: RegistrationBindValue[] = [
        input.activityId,
        todayBusinessDate(),
        JSON.stringify(input.questions),
        input.integrityEnabled ? 1 : 0,
    ];
    const activeCount = `(SELECT COUNT(*)
        FROM activity_registrations AS active_registration
        WHERE active_registration.activity_id = activity.id
          AND active_registration.registration_status = 'active')`;
    const activeCapacity = `${activeCount} < activity.expected_participants`;
    const noEligibleWaitlist = `NOT EXISTS (
        SELECT 1 FROM activity_registrations AS queued_registration
        WHERE queued_registration.activity_id = activity.id
          AND queued_registration.registration_status = 'waitlisted'
          AND ${eligibleWaitlistRegistrationSql("queued_registration")}
    )`;
    const waitlistAvailable = `${activeCount} <= activity.expected_participants
      AND (SELECT COUNT(*)
        FROM activity_registrations AS queued_registration
        WHERE queued_registration.activity_id = activity.id
          AND queued_registration.registration_status = 'waitlisted'
          AND ${eligibleWaitlistRegistrationSql("queued_registration")}) < ${WAITLIST_LIMIT_SQL}`;
    const shouldWaitlist = `(
        NOT (${activeCapacity}) OR NOT (${noEligibleWaitlist})
    )`;
    const answers = JSON.stringify(input.answers);
    const statements: ActivityLifecycleStatement[] = [];
    const activeIndexes: number[] = [];
    const waitlistIndexes: number[] = [];
    const integrityCountForParticipant = integrityLossCountForParticipantSql(source);
    if (input.integrityEnabled) {
        statements.push({
            sql: `${INTEGRITY_CLOCK_CTE}
                UPDATE activity_registrations AS registration
                SET registration_status = 'cancelled',
                    registration_updated_at = ?, updated_at = ?
                WHERE registration.registration_status = 'waitlisted'
                  AND ${source.registrationPredicate}
                  AND EXISTS (
                    SELECT 1 FROM activities AS queued_activity
                    WHERE queued_activity.id = registration.activity_id
                      AND queued_activity.integrity_enabled = 1
                  )
                  AND ${integrityCountForParticipant} >= 3`,
            params: [
                ...integrityClockParams(input.timestamp),
                input.timestamp,
                input.timestamp,
                ...source.registrationParams,
                ...source.registrationParams,
            ],
        });
        statements.push({
            sql: `${INTEGRITY_CLOCK_CTE}
                UPDATE activity_registrations AS registration
                SET registration_status = 'cancelled',
                    registration_updated_at = ?, updated_at = ?
                WHERE registration.activity_id = ?
                  AND registration.registration_status = 'waitlisted'
                  AND (
                    NOT (${eligibleWaitlistRegistrationSql("registration")})
                    OR ${integrityLossCountForRegistrationSql("registration")} >= 3
                  )
                  AND EXISTS (
                    SELECT 1 FROM activities AS activity WHERE ${activityGuard}
                  )`,
            params: [
                ...integrityClockParams(input.timestamp),
                input.timestamp,
                input.timestamp,
                input.activityId,
                ...activityParams,
            ],
        });
    } else {
        statements.push({
            sql: `UPDATE activity_registrations AS registration
                SET registration_status = 'cancelled',
                    registration_updated_at = ?, updated_at = ?
                WHERE registration.activity_id = ?
                  AND registration.registration_status = 'waitlisted'
                  AND NOT (${eligibleWaitlistRegistrationSql("registration")})
                  AND EXISTS (
                    SELECT 1 FROM activities AS activity WHERE ${activityGuard}
                  )`,
            params: [
                input.timestamp,
                input.timestamp,
                input.activityId,
                ...activityParams,
            ],
        });
    }
    const integrityPrefix = input.integrityEnabled ? `${INTEGRITY_CLOCK_CTE}\n` : "";
    const strictIntegrityGate = input.integrityEnabled
        ? `AND ${integrityCountForParticipant} < 3`
        : "";
    const activeReviveIntegrityGate = input.integrityEnabled
        ? `AND (${integrityCountForParticipant} < 3
            OR registration.integrity_late_cancelled_at IS NOT NULL)`
        : "";
    activeIndexes.push(statements.length);
    statements.push({
            sql: `${integrityPrefix}UPDATE activity_registrations AS registration
                SET registration_status = 'active', registered_at = ?, waitlisted_at = NULL,
                    registration_updated_at = ?, answers = ?, updated_at = ?
                WHERE registration.activity_id = ? AND registration.client_code = ?
                  AND ${source.registrationPredicate}
                  AND registration.registration_status = 'cancelled'
                  AND EXISTS (
                    SELECT 1 FROM activities AS activity
                    WHERE ${activityGuard}
                      AND ${activeCapacity}
                      AND ${noEligibleWaitlist}
                      ${activeReviveIntegrityGate}
                  )
                  AND EXISTS (
                    SELECT 1 FROM ${source.tableName} AS participant
                    WHERE ${source.activePredicate}
                  )`,
            params: [
                ...(input.integrityEnabled ? integrityClockParams(input.timestamp) : []),
                input.timestamp,
                input.timestamp,
                answers,
                input.timestamp,
                input.activityId,
                input.participant.code,
                ...source.registrationParams,
                ...activityParams,
                ...(input.integrityEnabled ? source.registrationParams : []),
                ...source.activeParams,
            ],
        });
    activeIndexes.push(statements.length);
    statements.push({
            sql: `${integrityPrefix}INSERT INTO activity_registrations (
                    activity_id, client_id, child_member_id, temporary_participant_id,
                    client_code, registration_status, registered_at, waitlisted_at,
                    registration_updated_at, answers, created_at, updated_at
                )
                SELECT activity.id, ${source.participantColumns}, ${source.codeExpression},
                    'active', ?, NULL, ?, ?, ?, ?
                FROM activities AS activity
                JOIN ${source.tableName} AS participant ON ${source.activePredicate}
                WHERE ${activityGuard}
                  AND ${activeCapacity}
                  AND ${noEligibleWaitlist}
                  ${strictIntegrityGate}
                ON CONFLICT(activity_id, client_code) DO NOTHING`,
            params: [
                ...(input.integrityEnabled ? integrityClockParams(input.timestamp) : []),
                input.timestamp,
                input.timestamp,
                answers,
                input.timestamp,
                input.timestamp,
                ...source.activeParams,
                ...activityParams,
                ...(input.integrityEnabled ? source.registrationParams : []),
            ],
        });
    waitlistIndexes.push(statements.length);
    statements.push({
            sql: `${integrityPrefix}UPDATE activity_registrations AS registration
                SET registration_status = 'waitlisted', registered_at = NULL,
                    waitlisted_at = ?, registration_updated_at = ?,
                    answers = ?, updated_at = ?
                WHERE registration.activity_id = ? AND registration.client_code = ?
                  AND ${source.registrationPredicate}
                  AND registration.registration_status = 'cancelled'
                  AND EXISTS (
                    SELECT 1 FROM activities AS activity
                    WHERE ${activityGuard}
                      AND ${shouldWaitlist}
                      AND ${waitlistAvailable}
                      ${strictIntegrityGate}
                  )
                  AND EXISTS (
                    SELECT 1 FROM ${source.tableName} AS participant
                    WHERE ${source.activePredicate}
                  )`,
            params: [
                ...(input.integrityEnabled ? integrityClockParams(input.timestamp) : []),
                input.timestamp,
                input.timestamp,
                answers,
                input.timestamp,
                input.activityId,
                input.participant.code,
                ...source.registrationParams,
                ...activityParams,
                ...(input.integrityEnabled ? source.registrationParams : []),
                ...source.activeParams,
            ],
        });
    waitlistIndexes.push(statements.length);
    statements.push({
            sql: `${integrityPrefix}INSERT INTO activity_registrations (
                    activity_id, client_id, child_member_id, temporary_participant_id,
                    client_code, registration_status, registered_at, waitlisted_at,
                    registration_updated_at, answers, created_at, updated_at
                )
                SELECT activity.id, ${source.participantColumns}, ${source.codeExpression},
                    'waitlisted', NULL, ?, ?, ?, ?, ?
                FROM activities AS activity
                JOIN ${source.tableName} AS participant ON ${source.activePredicate}
                WHERE ${activityGuard}
                  AND ${shouldWaitlist}
                  AND ${waitlistAvailable}
                  ${strictIntegrityGate}
                ON CONFLICT(activity_id, client_code) DO NOTHING`,
            params: [
                ...(input.integrityEnabled ? integrityClockParams(input.timestamp) : []),
                input.timestamp,
                input.timestamp,
                answers,
                input.timestamp,
                input.timestamp,
                ...source.activeParams,
                ...activityParams,
                ...(input.integrityEnabled ? source.registrationParams : []),
            ],
        });
    return { statements, activeIndexes, waitlistIndexes };
}

async function findStoredTemporaryParticipant(
    db: AppDb,
    normalizedName: string,
    dob: string,
): Promise<StoredTemporaryParticipant | null> {
    const [row] = await db.select({
        id: schema.temporaryParticipants.id,
        code: sql<string>`'TMP' || printf('%04d', ${schema.temporaryParticipants.id})`,
        gender: schema.temporaryParticipants.gender,
        tel: schema.temporaryParticipants.tel,
        email: schema.temporaryParticipants.email,
        dob: schema.temporaryParticipants.dob,
        status: schema.temporaryParticipants.status,
    }).from(schema.temporaryParticipants).where(and(
        eq(
            sqliteNormalizedFirstLastNameSql(
                schema.temporaryParticipants.firstName,
                schema.temporaryParticipants.lastName,
            ),
            normalizedName,
        ),
        eq(schema.temporaryParticipants.dob, dob),
    )).limit(1);
    return row ?? null;
}

async function registerStoredTemporaryParticipant(
    db: AppDb,
    activityId: number,
    participant: StoredTemporaryParticipant,
    questions: ActivityQuestionnaire,
    answers: ActivityRegistrationAnswers,
    now?: Date,
): Promise<ActivityRegistrationResult> {
    return registerResolvedParticipant(db, {
        activityId,
        participant: {
            kind: "temporary_participant",
            id: participant.id,
            code: participant.code,
            gender: participant.gender,
            tel: participant.tel,
            email: participant.email,
        },
        questions,
        answers,
        now,
    });
}

async function completeStoredTemporaryParticipantContact(
    db: AppDb,
    participant: StoredTemporaryParticipant,
    input: TemporaryParticipantInput,
    now?: Date,
): Promise<StoredTemporaryParticipant> {
    const gender = input.gender as TemporaryParticipantGender;
    const tel = input.tel.trim();
    const email = input.email.trim();
    const completed = await db.update(schema.temporaryParticipants).set({
        gender,
        tel,
        email,
        ...(participant.gender !== gender
            ? { fsiiGenderDetail: null, otherGender: null }
            : {}),
        updatedAt: nowSqlDateTime(now),
    }).where(and(
        eq(schema.temporaryParticipants.id, participant.id),
        eq(schema.temporaryParticipants.status, "active"),
    ));
    if (Number(completed.meta.changes ?? 0) !== 1) {
        throw new ActivityRegistrationRejectedError("participant_inactive");
    }
    return { ...participant, gender, tel, email, status: "active" };
}

export async function registerResolvedParticipant(
    db: AppDb,
    input: {
        activityId: number;
        participant: ResolvedActivityParticipant;
        questions: ActivityQuestionnaire;
        answers: ActivityRegistrationAnswers;
        now?: Date;
    },
): Promise<ActivityRegistrationResult> {
    const answers = parseSubmissionActivityRegistrationAnswers(input.answers, input.questions);
    if (!answers) {
        throw new Error("invalid_activity_registration_answers");
    }
    const normalizedInput = { ...input, answers };
    const policy = await getPublicActivityRegistrationPolicy(
        db,
        input.activityId,
        input.questions,
    );
    if (!policy) {
        throw new Error("activity_unavailable");
    }
    if (
        input.participant.kind !== "temporary_participant" &&
        isReservedTemporaryParticipantCode(input.participant.code)
    ) {
        throw new ActivityRegistrationRejectedError("identity_conflict");
    }
    const timestamp = nowSqlDateTime(input.now);
    const existing = await findStoredActivityRegistration(db, input.activityId, input.participant.code);
    if (existing && !storedRegistrationMatchesParticipant(existing, input.participant)) {
        throw new ActivityRegistrationRejectedError("identity_conflict");
    }
    const classification = registrationClassificationStatements({
        ...normalizedInput,
        timestamp,
        integrityEnabled: existing?.registrationStatus === "active"
            ? false
            : policy.integrityEnabled,
    });
    const batch = await rawBatch(db, {
        reasonKey: "public-activity-registration.atomic-write",
        statements: classification.statements,
    });
    const activeChanged = classification.activeIndexes.reduce(
        (changes, index) => changes + Number(batch[index]?.meta.changes ?? 0),
        0,
    ) > 0;
    const waitlistedChanged = classification.waitlistIndexes.reduce(
        (changes, index) => changes + Number(batch[index]?.meta.changes ?? 0),
        0,
    ) > 0;
    const current = await findStoredActivityRegistration(
        db,
        input.activityId,
        input.participant.code,
    );
    if (current && !storedRegistrationMatchesParticipant(current, input.participant)) {
        throw new ActivityRegistrationRejectedError("identity_conflict");
    }
    if (current?.registrationStatus === "active") {
        await assertRegistrationPrerequisites(db, normalizedInput);
        return activeChanged ? "registered" : "already_registered";
    }
    if (current?.registrationStatus === "waitlisted") {
        await assertRegistrationPrerequisites(db, normalizedInput);
        return waitlistedChanged ? "waitlisted" : "already_waitlisted";
    }
    const latestPolicy = await getPublicActivityRegistrationPolicy(
        db,
        input.activityId,
        input.questions,
    );
    if (!latestPolicy || latestPolicy.integrityEnabled !== policy.integrityEnabled) {
        throw new Error("activity_unavailable");
    }
    if (policy.integrityEnabled) {
        const integrity = await getPublicActivityIntegritySummary(db, input.participant, input.now);
        if (integrity.registrationBlocked) return "integrity_blocked";
    }
    await assertRegistrationPrerequisites(db, normalizedInput);
    return "full";
}

export async function createAndRegisterNonMember(
    db: AppDb,
    input: {
        activityId: number;
        participant: TemporaryParticipantInput;
        questions: ActivityQuestionnaire;
        answers: ActivityRegistrationAnswers;
        now?: Date;
    },
): Promise<ActivityRegistrationResult> {
    const answers = parseSubmissionActivityRegistrationAnswers(input.answers, input.questions);
    if (!answers) {
        throw new Error("invalid_activity_registration_answers");
    }
    const normalizedInput = { ...input, answers };
    if (!await requirePublicActivity(db, input.activityId, input.questions)) {
        throw new Error("activity_unavailable");
    }
    const validationIssue = validateTemporaryParticipantInput(input.participant);
    if (validationIssue) throw new Error(validationIssue);
    const normalizedName = normalizeTemporaryParticipantStructuredName(
        input.participant.firstName,
        input.participant.lastName,
    );
    const dob = input.participant.dob.trim();
    const existing = await findStoredTemporaryParticipant(db, normalizedName, dob);
    if (existing) {
        const completed = await completeStoredTemporaryParticipantContact(
            db,
            existing,
            input.participant,
            input.now,
        );
        return registerStoredTemporaryParticipant(
            db,
            input.activityId,
            completed,
            input.questions,
            normalizedInput.answers,
            input.now,
        );
    }
    const searchIndex = buildChineseNameSearchIndex(input.participant.chineseName ?? "");
    const policy = await getPublicActivityRegistrationPolicy(
        db,
        input.activityId,
        input.questions,
    );
    if (!policy) throw new Error("activity_unavailable");
    const timestamp = nowSqlDateTime(input.now);
    const temporarySource: ParticipantRegistrationSource = {
        tableName: "temporary_participants",
        codeExpression: "'TMP' || printf('%04d', participant.id)",
        participantColumns: "NULL, NULL, participant.id",
        activePredicate: `${sqliteNormalizedFirstLastNameExpression("participant.first_name", "participant.last_name")} = ?
            AND participant.dob = ? AND participant.status = 'active'`,
        activeParams: [normalizedName, dob],
        registrationPredicate: `registration.client_id IS NULL
            AND registration.child_member_id IS NULL
            AND registration.temporary_participant_id = (
                SELECT existing_participant.id FROM temporary_participants AS existing_participant
                WHERE ${sqliteNormalizedFirstLastNameExpression("existing_participant.first_name", "existing_participant.last_name")} = ?
                  AND existing_participant.dob = ?
            )`,
        registrationParams: [normalizedName, dob],
    };
    try {
        const classification = registrationClassificationStatements({
            activityId: input.activityId,
            participant: {
                kind: "temporary_participant",
                id: 0,
                code: "",
                gender: normalizeGender(input.participant.gender),
                tel: input.participant.tel.trim(),
                email: input.participant.email.trim(),
            },
            questions: input.questions,
            answers: normalizedInput.answers,
            timestamp,
            integrityEnabled: policy.integrityEnabled,
        }, temporarySource);
        const batch = await rawBatch(db, {
            reasonKey: "public-activity-registration.atomic-write",
            statements: [
                {
                    sql: `INSERT INTO temporary_participants (
                        first_name, last_name, chinese_name,
                        chinese_name_pinyin, chinese_name_pinyin_compact,
                        chinese_name_pinyin_initials, chinese_name_pinyin_given_surname,
                        chinese_name_search_terms, gender, dob, tel, email,
                        wechat_id, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'active', ?, ?)`,
                    params: [
                        cleanTemporaryParticipantLegalName(input.participant.firstName),
                        cleanTemporaryParticipantLegalName(input.participant.lastName),
                        input.participant.chineseName?.trim() || null,
                        searchIndex.pinyin,
                        searchIndex.pinyinCompact,
                        searchIndex.pinyinInitials,
                        searchIndex.pinyinGivenSurname,
                        searchIndex.searchTerms,
                        input.participant.gender,
                        dob,
                        input.participant.tel.trim(),
                        input.participant.email.trim(),
                        timestamp,
                        timestamp,
                    ],
                },
                ...classification.statements,
                {
                    sql: `INSERT INTO activity_registrations (
                        activity_id, temporary_participant_id, client_code, registration_status,
                        answers, created_at, updated_at
                    )
                    SELECT NULL, participant.id, 'TMP' || printf('%04d', participant.id),
                        'cancelled', ?, ?, ?
                    FROM temporary_participants AS participant
                    WHERE ${sqliteNormalizedFirstLastNameExpression("participant.first_name", "participant.last_name")} = ? AND participant.dob = ?
                      AND NOT EXISTS (
                        SELECT 1 FROM activity_registrations AS registration
                        WHERE registration.activity_id = ?
                          AND registration.temporary_participant_id = participant.id
                      )`,
                    params: [
                        JSON.stringify(normalizedInput.answers),
                        timestamp,
                        timestamp,
                        normalizedName,
                        dob,
                        input.activityId,
                    ],
                },
            ],
        });
        const participant = await findStoredTemporaryParticipant(db, normalizedName, dob);
        if (!participant) throw new Error("temporary_participant_missing_after_registration");
        const registration = await findStoredActivityRegistration(
            db,
            input.activityId,
            participant.code,
        );
        if (registration?.registrationStatus === "active") {
            return classification.activeIndexes.reduce(
                (changes, index) => changes + Number(batch[index + 1]?.meta.changes ?? 0),
                0,
            ) > 0
                ? "registered"
                : "already_registered";
        }
        if (registration?.registrationStatus === "waitlisted") {
            return classification.waitlistIndexes.reduce(
                (changes, index) => changes + Number(batch[index + 1]?.meta.changes ?? 0),
                0,
            ) > 0
                ? "waitlisted"
                : "already_waitlisted";
        }
        throw new Error("temporary_registration_missing_after_batch");
    } catch (cause) {
        const concurrent = await findStoredTemporaryParticipant(db, normalizedName, dob);
        if (concurrent) {
            const completed = await completeStoredTemporaryParticipantContact(
                db,
                concurrent,
                input.participant,
                input.now,
            );
            return registerStoredTemporaryParticipant(
                db,
                input.activityId,
                completed,
                input.questions,
                normalizedInput.answers,
                input.now,
            );
        }
        if (!await requirePublicActivity(db, input.activityId, input.questions)) {
            throw new Error("activity_unavailable");
        }
        const capacity = await getPublicActivityCapacitySummary(db, input.activityId);
        const activeAvailable = Boolean(
            capacity && capacity.activeCount < capacity.limit && capacity.waitlistedCount === 0,
        );
        const waitlistAvailable = Boolean(
            capacity &&
            !activeAvailable &&
            capacity.activeCount <= capacity.limit &&
            capacity.waitlistedCount < capacity.waitlistLimit,
        );
        if (capacity && !activeAvailable && !waitlistAvailable) return "full";
        throw cause;
    }
}
