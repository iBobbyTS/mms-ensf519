import { and, asc, count, desc, eq, or, sql, type SQL } from "drizzle-orm";

import {
    buildChineseNameSearchIndex,
    buildChineseNameSearchQuery,
} from "$lib/server/client-name-index";
import {
    cleanTemporaryParticipantLegalName,
    formatTemporaryParticipantLegalName,
    formatTemporaryParticipantCode,
    isTemporaryParticipantGender,
    normalizeTemporaryParticipantLegalName,
    normalizeTemporaryParticipantStructuredName,
    parseTemporaryParticipantCode,
    resolveDobAgeWriteValues,
    type DobAgePreviousState,
    type TemporaryParticipantData,
    type TemporaryParticipantInput,
    type TemporaryParticipantValidationIssue,
    validateTemporaryParticipantInput,
} from "$lib/temporary-participant";
import { restoreMemberGender } from "$lib/gender";
import type { TemporaryParticipantDirectorySort } from "$lib/temporary-participant-directory";
import { type AppDb, getLastInsertId, nowSqlDate, nowSqlDateTime } from "$lib/server/db";
import { schema } from "$lib/server/db-schema";
import { sqliteNormalizedFirstLastNameSql } from "$lib/server/legal-name";

export type TemporaryParticipantRecord = TemporaryParticipantData & { id: number };

export class TemporaryParticipantValidationError extends Error {
    readonly issue: TemporaryParticipantValidationIssue;

    constructor(issue: TemporaryParticipantValidationIssue) {
        super(issue);
        this.issue = issue;
    }
}

export class TemporaryParticipantDuplicateError extends Error {
    readonly participant: TemporaryParticipantRecord;

    constructor(participant: TemporaryParticipantRecord) {
        super("temporary_participant_duplicate");
        this.participant = participant;
    }
}

const temporaryParticipantCodeExpression = sql<string>`'TMP' || printf('%04d', ${schema.temporaryParticipants.id})`;

function mapTemporaryParticipantRow(row: {
    id: number;
    participant_code?: string;
    legal_name?: string;
    gender: "Male" | "Female" | "Other" | null;
    chinese_name_pinyin?: string | null;
    chinese_name_pinyin_compact?: string | null;
    chinese_name_pinyin_initials?: string | null;
    chinese_name_pinyin_given_surname?: string | null;
    chinese_name_search_terms?: string | null;
    fsii_registration_date: string | null;
    first_name: string | null;
    last_name: string | null;
    legal_name_photo_id_verified: number;
    english_name: string | null;
    chinese_name: string | null;
    dob: string | null;
    age_years: number | null;
    age_updated_date: string | null;
    fsii_gender_detail: string | null;
    other_gender: string | null;
    cob: string | null;
    birth_province: string | null;
    birth_city: string | null;
    residential_status: string | null;
    is_volunteer: number;
    address: string | null;
    community: string | null;
    postal_code: string | null;
    tel: string;
    email: string;
    wechat_id: string | null;
    emergency_contact_person: string | null;
    emergency_contact_relationship: string | null;
    emergency_contact_tel: string | null;
    major_language: string | null;
    population_group: string | null;
    marital_status: string | null;
    housing_situation: string | null;
    primary_income: string | null;
    grade_in_school: number | null;
    number_child: number;
    number_adult: number;
    highest_grade: string | null;
    education_level: string | null;
    indigenous_identity: string | null;
    arrival_month: string | null;
    physical_accessibility_difficulty: string | null;
    cognitive_difficulty: string | null;
    emotional_mental_health_condition: string | null;
    remark: string | null;
    converted_client_id: number | null;
    converted_client_code: string | null;
    converted_at: string | null;
    status: "active" | "disabled";
    created_at: string;
    updated_at: string;
}): TemporaryParticipantRecord {
    return {
        id: row.id,
        participantCode:
            row.participant_code ?? formatTemporaryParticipantCode(row.id),
        legalName: formatTemporaryParticipantLegalName(
            row.first_name,
            row.last_name,
        ),
        fsiiRegistrationDate: row.fsii_registration_date ?? "",
        firstName: row.first_name ?? "",
        lastName: row.last_name ?? "",
        legalNamePhotoIdVerified: row.legal_name_photo_id_verified === 1,
        englishName: row.english_name ?? "",
        chineseName: row.chinese_name ?? "",
        gender: restoreMemberGender(row.gender, row.fsii_gender_detail),
        otherGender: row.other_gender ?? "",
        dob: row.dob ?? "",
        ageYears: row.age_years === null ? "" : String(row.age_years),
        ageUpdatedDate: row.age_updated_date ?? "",
        cob: row.cob ?? "",
        birthProvince: row.birth_province ?? "",
        birthCity: row.birth_city ?? "",
        residentialStatus: row.residential_status ?? "",
        isVolunteer: row.is_volunteer === 1,
        address: row.address ?? "",
        community: row.community ?? "",
        postalCode: row.postal_code ?? "",
        tel: row.tel,
        email: row.email,
        wechatID: row.wechat_id ?? "",
        wechatId: row.wechat_id,
        emergencyContactPerson: row.emergency_contact_person ?? "",
        emergencyContactRelationship: row.emergency_contact_relationship ?? "",
        emergencyContactTel: row.emergency_contact_tel ?? "",
        majorLanguage: row.major_language ?? "",
        populationGroup: row.population_group ?? "",
        maritalStatus: row.marital_status ?? "",
        housingSituation: row.housing_situation ?? "",
        primaryIncome: row.primary_income ?? "",
        gradeInSchool: row.grade_in_school === null ? "" : String(row.grade_in_school),
        numberChild: row.number_child,
        numberAdult: row.number_adult,
        highestGrade: row.highest_grade ?? "",
        educationLevel: row.education_level ?? "",
        indigenousIdentity: row.indigenous_identity ?? "",
        arrivalMonth: row.arrival_month ?? "",
        physicalAccessibilityDifficulty: row.physical_accessibility_difficulty ?? "",
        cognitiveDifficulty: row.cognitive_difficulty ?? "",
        emotionalMentalHealthCondition: row.emotional_mental_health_condition ?? "",
        remark: row.remark ?? "",
        convertedClientId: row.converted_client_id,
        convertedClientCode: row.converted_client_code,
        convertedAt: row.converted_at,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function temporaryParticipantSelection() {
    return {
        id: schema.temporaryParticipants.id,
        participant_code: temporaryParticipantCodeExpression,
        fsii_registration_date: schema.temporaryParticipants.fsiiRegistrationDate,
        first_name: schema.temporaryParticipants.firstName,
        last_name: schema.temporaryParticipants.lastName,
        legal_name_photo_id_verified: schema.temporaryParticipants.legalNamePhotoIdVerified,
        english_name: schema.temporaryParticipants.englishName,
        chinese_name: schema.temporaryParticipants.chineseName,
        chinese_name_pinyin: schema.temporaryParticipants.chineseNamePinyin,
        chinese_name_pinyin_compact: schema.temporaryParticipants.chineseNamePinyinCompact,
        chinese_name_pinyin_initials: schema.temporaryParticipants.chineseNamePinyinInitials,
        chinese_name_pinyin_given_surname: schema.temporaryParticipants.chineseNamePinyinGivenSurname,
        chinese_name_search_terms: schema.temporaryParticipants.chineseNameSearchTerms,
        gender: schema.temporaryParticipants.gender,
        fsii_gender_detail: schema.temporaryParticipants.fsiiGenderDetail,
        other_gender: schema.temporaryParticipants.otherGender,
        dob: schema.temporaryParticipants.dob,
        age_years: schema.temporaryParticipants.ageYears,
        age_updated_date: schema.temporaryParticipants.ageUpdatedDate,
        cob: schema.temporaryParticipants.cob,
        birth_province: schema.temporaryParticipants.birthProvince,
        birth_city: schema.temporaryParticipants.birthCity,
        residential_status: schema.temporaryParticipants.residentialStatus,
        is_volunteer: schema.temporaryParticipants.isVolunteer,
        address: schema.temporaryParticipants.address,
        community: schema.temporaryParticipants.community,
        postal_code: schema.temporaryParticipants.postalCode,
        tel: schema.temporaryParticipants.tel,
        email: schema.temporaryParticipants.email,
        wechat_id: schema.temporaryParticipants.wechatId,
        emergency_contact_person: schema.temporaryParticipants.emergencyContactPerson,
        emergency_contact_relationship: schema.temporaryParticipants.emergencyContactRelationship,
        emergency_contact_tel: schema.temporaryParticipants.emergencyContactTel,
        major_language: schema.temporaryParticipants.majorLanguage,
        population_group: schema.temporaryParticipants.populationGroup,
        marital_status: schema.temporaryParticipants.maritalStatus,
        housing_situation: schema.temporaryParticipants.housingSituation,
        primary_income: schema.temporaryParticipants.primaryIncome,
        grade_in_school: schema.temporaryParticipants.gradeInSchool,
        number_child: schema.temporaryParticipants.numberChild,
        number_adult: schema.temporaryParticipants.numberAdult,
        highest_grade: schema.temporaryParticipants.highestGrade,
        education_level: schema.temporaryParticipants.educationLevel,
        indigenous_identity: schema.temporaryParticipants.indigenousIdentity,
        arrival_month: schema.temporaryParticipants.arrivalMonth,
        physical_accessibility_difficulty: schema.temporaryParticipants.physicalAccessibilityDifficulty,
        cognitive_difficulty: schema.temporaryParticipants.cognitiveDifficulty,
        emotional_mental_health_condition: schema.temporaryParticipants.emotionalMentalHealthCondition,
        remark: schema.temporaryParticipants.remark,
        converted_client_id: schema.temporaryParticipants.convertedClientId,
        converted_client_code: schema.clients.clientCode,
        converted_at: schema.temporaryParticipants.convertedAt,
        status: schema.temporaryParticipants.status,
        created_at: schema.temporaryParticipants.createdAt,
        updated_at: schema.temporaryParticipants.updatedAt,
    };
}

export async function getTemporaryParticipantById(
    db: AppDb,
    participantId: number,
): Promise<TemporaryParticipantRecord | null> {
    const [row] = await db
        .select(temporaryParticipantSelection())
        .from(schema.temporaryParticipants)
        .leftJoin(
            schema.clients,
            eq(schema.temporaryParticipants.convertedClientId, schema.clients.id),
        )
        .where(eq(schema.temporaryParticipants.id, participantId))
        .limit(1);

    return row ? mapTemporaryParticipantRow(row) : null;
}

export async function listTemporaryParticipants(
    db: AppDb,
    input: {
        page: number;
        limit: number;
        search?: string;
        sort?: TemporaryParticipantDirectorySort;
    },
): Promise<{ rows: TemporaryParticipantRecord[]; total: number }> {
    const page = Math.max(Math.trunc(input.page), 1);
    const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 100);
    const searchPredicate = buildTemporaryParticipantSearchPredicate(
        input.search ?? "",
    );
    const [rows, totalRows] = await Promise.all([
        db
            .select(temporaryParticipantSelection())
            .from(schema.temporaryParticipants)
            .leftJoin(
                schema.clients,
                eq(schema.temporaryParticipants.convertedClientId, schema.clients.id),
            )
            .where(searchPredicate)
            .orderBy(
                input.sort?.sort === "participantCode" && input.sort.dir === "asc"
                    ? asc(schema.temporaryParticipants.id)
                    : desc(schema.temporaryParticipants.id),
            )
            .limit(limit)
            .offset((page - 1) * limit),
        db
            .select({ value: count() })
            .from(schema.temporaryParticipants)
            .where(searchPredicate),
    ]);

    return {
        rows: rows.map(mapTemporaryParticipantRow),
        total: Number(totalRows[0]?.value ?? 0),
    };
}

function buildTemporaryParticipantSearchPredicate(search: string): SQL | undefined {
    const cleanedSearch = cleanTemporaryParticipantLegalName(search);
    const normalizedSearch = normalizeTemporaryParticipantLegalName(cleanedSearch);
    if (!normalizedSearch) return undefined;

    const searchQuery = buildChineseNameSearchQuery(cleanedSearch);
    const pinyinColumns = [
        schema.temporaryParticipants.chineseNamePinyin,
        schema.temporaryParticipants.chineseNamePinyinCompact,
        schema.temporaryParticipants.chineseNamePinyinInitials,
        schema.temporaryParticipants.chineseNamePinyinGivenSurname,
    ];
    const pinyinLikePredicates = pinyinColumns.flatMap((column) =>
        searchQuery.likePatterns.map(
            (pattern) =>
                sql<boolean>`LOWER(COALESCE(${column}, '')) LIKE LOWER(${pattern})`,
        ),
    );
    const searchTermsLikePredicates = searchQuery.exactTermPatterns.flatMap(
        (pattern) =>
            pattern === null
                ? []
                : [
                      sql<boolean>`COALESCE(${schema.temporaryParticipants.chineseNameSearchTerms}, '') LIKE ${pattern} COLLATE NOCASE`,
                  ],
    );

    return or(
        sql<boolean>`INSTR(${sqliteNormalizedFirstLastNameSql(schema.temporaryParticipants.firstName, schema.temporaryParticipants.lastName)}, ${normalizedSearch}) > 0`,
        sql<boolean>`INSTR(UPPER(${temporaryParticipantCodeExpression}), UPPER(${cleanedSearch})) > 0`,
        sql<boolean>`INSTR(LOWER(COALESCE(${schema.temporaryParticipants.tel}, '')), LOWER(${cleanedSearch})) > 0`,
        sql<boolean>`INSTR(LOWER(COALESCE(${schema.temporaryParticipants.email}, '')), LOWER(${cleanedSearch})) > 0`,
        ...pinyinLikePredicates,
        ...searchTermsLikePredicates,
    );
}

export async function getActiveTemporaryParticipantByCode(
    db: AppDb,
    participantCode: string,
): Promise<TemporaryParticipantRecord | null> {
    const participantId = parseTemporaryParticipantCode(participantCode);
    if (participantId === null) return null;

    const participant = await getTemporaryParticipantById(db, participantId);
    return participant?.status === "active" ? participant : null;
}

export async function disableTemporaryParticipant(
    db: AppDb,
    participantId: number,
): Promise<"disabled" | "not_found"> {
    if (!Number.isSafeInteger(participantId) || participantId <= 0) {
        return "not_found";
    }

    const result = await db
        .update(schema.temporaryParticipants)
        .set({ status: "disabled", updatedAt: nowSqlDateTime() })
        .where(
            and(
                eq(schema.temporaryParticipants.id, participantId),
                eq(schema.temporaryParticipants.status, "active"),
            ),
        );

    return Number(result.meta.changes ?? 0) === 1 ? "disabled" : "not_found";
}

export async function findTemporaryParticipantDuplicate(
    db: AppDb,
    firstName: string,
    lastName: string,
    dob: string,
): Promise<TemporaryParticipantRecord | null> {
    const normalizedLegalName = normalizeTemporaryParticipantStructuredName(
        firstName,
        lastName,
    );
    if (!normalizedLegalName || !dob.trim()) return null;

    const [row] = await db
        .select(temporaryParticipantSelection())
        .from(schema.temporaryParticipants)
        .leftJoin(
            schema.clients,
            eq(schema.temporaryParticipants.convertedClientId, schema.clients.id),
        )
        .where(
            and(
                eq(
                    sqliteNormalizedFirstLastNameSql(
                        schema.temporaryParticipants.firstName,
                        schema.temporaryParticipants.lastName,
                    ),
                    normalizedLegalName,
                ),
                eq(schema.temporaryParticipants.dob, dob.trim()),
            ),
        )
        .limit(1);

    return row ? mapTemporaryParticipantRow(row) : null;
}

function nullableText(value: string | null | undefined): string | null {
    return value?.trim() || null;
}

function temporaryParticipantValuesFromInput(
    input: TemporaryParticipantInput,
    {
        previousAge = null,
        today = nowSqlDate(),
    }: { previousAge?: DobAgePreviousState; today?: string } = {},
) {
    return {
        firstName: cleanTemporaryParticipantLegalName(input.firstName),
        lastName: cleanTemporaryParticipantLegalName(input.lastName),
        legalNamePhotoIdVerified: input.legalNamePhotoIdVerified ? 1 : 0,
        englishName: nullableText(input.englishName),
        chineseName: nullableText(input.chineseName),
        gender: isTemporaryParticipantGender(input.gender) ? input.gender : null,
        fsiiGenderDetail: isTemporaryParticipantGender(input.gender)
            ? input.fsiiGenderDetail ?? null
            : null,
        otherGender: input.gender === "Other" && !input.fsiiGenderDetail ? nullableText(input.otherGender) : null,
        // Age mode wins: a residual dob text is written as NULL; switching back
        // to dob mode clears both age columns (same rule as member clients).
        dob: input.dobAgeOnly ? null : input.dob.trim(),
        ...resolveDobAgeWriteValues(input, previousAge, today),
        cob: nullableText(input.cob),
        birthProvince: nullableText(input.birthProvince),
        birthCity: nullableText(input.birthCity),
        residentialStatus: nullableText(input.residentialStatus),
        isVolunteer: input.isVolunteer ? 1 : 0,
        address: nullableText(input.address),
        community: nullableText(input.community),
        postalCode: nullableText(input.postalCode),
        tel: input.tel.trim(),
        email: input.email.trim(),
        wechatId: nullableText(input.wechatId ?? input.wechatID),
        emergencyContactPerson: nullableText(input.emergencyContactPerson),
        emergencyContactRelationship: nullableText(input.emergencyContactRelationship),
        emergencyContactTel: nullableText(input.emergencyContactTel),
        majorLanguage: nullableText(input.majorLanguage),
        populationGroup: nullableText(input.populationGroup),
        maritalStatus: nullableText(input.maritalStatus),
        housingSituation: nullableText(input.housingSituation),
        primaryIncome: nullableText(input.primaryIncome),
        gradeInSchool: input.gradeInSchool ? Number(input.gradeInSchool) : null,
        numberChild: input.numberChild ?? 0,
        numberAdult: input.numberAdult ?? 0,
        highestGrade: nullableText(input.highestGrade),
        educationLevel: nullableText(input.educationLevel),
        indigenousIdentity: nullableText(input.indigenousIdentity),
        arrivalMonth: nullableText(input.arrivalMonth),
        physicalAccessibilityDifficulty: nullableText(input.physicalAccessibilityDifficulty),
        cognitiveDifficulty: nullableText(input.cognitiveDifficulty),
        emotionalMentalHealthCondition: nullableText(input.emotionalMentalHealthCondition),
        remark: nullableText(input.remark),
    };
}

export async function createTemporaryParticipant(
    db: AppDb,
    input: TemporaryParticipantInput,
    validationContext: "public" | "admin" = "public",
): Promise<TemporaryParticipantRecord> {
    const validationIssue = validateTemporaryParticipantInput(input, new Date(), validationContext);
    if (validationIssue) {
        throw new TemporaryParticipantValidationError(validationIssue);
    }

    const chineseNameSearchIndex = buildChineseNameSearchIndex(input.chineseName ?? "");
    const duplicate = await findTemporaryParticipantDuplicate(
        db,
        input.firstName,
        input.lastName,
        input.dob,
    );
    if (duplicate) {
        throw new TemporaryParticipantDuplicateError(duplicate);
    }

    const timestamp = nowSqlDateTime();
    try {
        const result = await db.insert(schema.temporaryParticipants).values({
            chineseNamePinyin: chineseNameSearchIndex.pinyin,
            chineseNamePinyinCompact: chineseNameSearchIndex.pinyinCompact,
            chineseNamePinyinInitials: chineseNameSearchIndex.pinyinInitials,
            chineseNamePinyinGivenSurname: chineseNameSearchIndex.pinyinGivenSurname,
            chineseNameSearchTerms: chineseNameSearchIndex.searchTerms,
            ...temporaryParticipantValuesFromInput(input),
            status: "active",
            createdAt: timestamp,
            updatedAt: timestamp,
        });
        const participant = await getTemporaryParticipantById(
            db,
            getLastInsertId(result),
        );
        if (!participant) {
            throw new Error(
                "Temporary participant was not found after creation.",
            );
        }
        return participant;
    } catch (error) {
        const racedDuplicate = await findTemporaryParticipantDuplicate(
            db,
            input.firstName,
            input.lastName,
            input.dob,
        );
        if (racedDuplicate) {
            throw new TemporaryParticipantDuplicateError(racedDuplicate);
        }
        throw error;
    }
}

export async function updateTemporaryParticipant(
    db: AppDb,
    participantId: number,
    input: TemporaryParticipantInput,
    validationContext: "public" | "admin" = "public",
): Promise<TemporaryParticipantRecord | null> {
    if (!Number.isSafeInteger(participantId) || participantId <= 0) return null;
    const validationIssue = validateTemporaryParticipantInput(input, new Date(), validationContext);
    if (validationIssue) throw new TemporaryParticipantValidationError(validationIssue);

    const duplicate = await findTemporaryParticipantDuplicate(
        db,
        input.firstName,
        input.lastName,
        input.dob,
    );
    if (duplicate && duplicate.id !== participantId) {
        throw new TemporaryParticipantDuplicateError(duplicate);
    }

    const chineseNameSearchIndex = buildChineseNameSearchIndex(input.chineseName ?? "");
    // The restamp rule needs the stored age state before the overwrite.
    const previousParticipant = await getTemporaryParticipantById(db, participantId);
    if (!previousParticipant || previousParticipant.status !== "active") return null;
    try {
        const result = await db
            .update(schema.temporaryParticipants)
            .set({
                chineseNamePinyin: chineseNameSearchIndex.pinyin,
                chineseNamePinyinCompact: chineseNameSearchIndex.pinyinCompact,
                chineseNamePinyinInitials: chineseNameSearchIndex.pinyinInitials,
                chineseNamePinyinGivenSurname: chineseNameSearchIndex.pinyinGivenSurname,
                chineseNameSearchTerms: chineseNameSearchIndex.searchTerms,
                ...temporaryParticipantValuesFromInput(input, {
                    previousAge: {
                        ageYears: previousParticipant.ageYears === ""
                            ? null
                            : Number(previousParticipant.ageYears),
                        ageUpdatedDate: previousParticipant.ageUpdatedDate || null,
                    },
                }),
                updatedAt: nowSqlDateTime(),
            })
            .where(
                and(
                    eq(schema.temporaryParticipants.id, participantId),
                    eq(schema.temporaryParticipants.status, "active"),
                ),
            );
        if (Number(result.meta.changes ?? 0) !== 1) return null;
        return getTemporaryParticipantById(db, participantId);
    } catch (error) {
        const racedDuplicate = await findTemporaryParticipantDuplicate(
            db,
            input.firstName,
            input.lastName,
            input.dob,
        );
        if (racedDuplicate && racedDuplicate.id !== participantId) {
            throw new TemporaryParticipantDuplicateError(racedDuplicate);
        }
        throw error;
    }
}

export async function searchTemporaryParticipants(
    db: AppDb,
    input: {
        search: string;
        limit: number;
        dob?: string | null;
        exactNameOnly?: boolean;
    },
): Promise<{
    participants: TemporaryParticipantRecord[];
    exactMatch: TemporaryParticipantRecord | null;
    exactMatchCount: number;
}> {
    const search = cleanTemporaryParticipantLegalName(input.search);
    const normalizedSearch = normalizeTemporaryParticipantLegalName(search);
    if (!normalizedSearch) {
        return { participants: [], exactMatch: null, exactMatchCount: 0 };
    }

    const resolvedLimit = Math.min(Math.max(Math.trunc(input.limit), 1), 50);
    const searchQuery = buildChineseNameSearchQuery(search);
    const commonPredicates: SQL[] = [
        eq(schema.temporaryParticipants.status, "active"),
    ];
    if (input.dob?.trim()) {
        commonPredicates.push(
            eq(schema.temporaryParticipants.dob, input.dob.trim()),
        );
    }

    const nameExact = eq(
        sqliteNormalizedFirstLastNameSql(
            schema.temporaryParticipants.firstName,
            schema.temporaryParticipants.lastName,
        ),
        normalizedSearch,
    );
    const codeExact = sql<boolean>`UPPER(${temporaryParticipantCodeExpression}) = UPPER(${search})`;
    const pinyinColumns = [
        schema.temporaryParticipants.chineseNamePinyin,
        schema.temporaryParticipants.chineseNamePinyinCompact,
        schema.temporaryParticipants.chineseNamePinyinInitials,
        schema.temporaryParticipants.chineseNamePinyinGivenSurname,
    ];
    const searchTermsLikePredicates = searchQuery.exactTermPatterns.flatMap(
        (pattern) => pattern === null
            ? []
            : [sql<boolean>`COALESCE(${schema.temporaryParticipants.chineseNameSearchTerms}, '') LIKE ${pattern} COLLATE NOCASE`],
    );
    const pinyinExactPredicates = [
        ...pinyinColumns.flatMap((column) =>
            searchQuery.variants.map(
                (variant) => sql<boolean>`LOWER(COALESCE(${column}, '')) = LOWER(${variant})`,
            ),
        ),
        ...searchTermsLikePredicates,
    ];
    const pinyinExactPredicate = or(...pinyinExactPredicates);
    const matchPredicate = input.exactNameOnly
        ? or(nameExact, pinyinExactPredicate!)!
        : buildTemporaryParticipantSearchPredicate(search)!;

    const rows = await db
        .select(temporaryParticipantSelection())
        .from(schema.temporaryParticipants)
        .leftJoin(
            schema.clients,
            eq(schema.temporaryParticipants.convertedClientId, schema.clients.id),
        )
        .where(and(...commonPredicates, matchPredicate))
        .orderBy(
            sql`CASE WHEN ${codeExact} THEN 0 WHEN ${nameExact} THEN 1 ELSE 2 END`,
            asc(schema.temporaryParticipants.firstName),
            asc(schema.temporaryParticipants.dob),
        )
        .limit(resolvedLimit);

    const exactRows = await db
        .select(temporaryParticipantSelection())
        .from(schema.temporaryParticipants)
        .leftJoin(
            schema.clients,
            eq(schema.temporaryParticipants.convertedClientId, schema.clients.id),
        )
        .where(and(...commonPredicates, or(codeExact, nameExact, pinyinExactPredicate!)!))
        .orderBy(asc(schema.temporaryParticipants.id))
        .limit(2);

    return {
        participants: rows.map(mapTemporaryParticipantRow),
        exactMatch:
            exactRows.length === 1
                ? mapTemporaryParticipantRow(exactRows[0])
                : null,
        exactMatchCount: exactRows.length,
    };
}
