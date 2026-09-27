import { and, asc, desc, eq, exists, gte, inArray, isNull, like, lt, lte, ne, notExists, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";

import {
    DEFAULT_MEMBERSHIP_STATUS_FILTER,
    isDefaultMembershipStatusFilter,
    type MembershipStatusFilter,
} from "$lib/membership-status-filter";
import type {
    ActivityListSortDirection,
    ActivityListSortField,
} from "$lib/activities";
import {
    FIXED_PROJECTS,
    isFixedProjectId,
    type ProjectListSortDirection,
    type ProjectListSortField,
} from "$lib/projects";
import {
    EMPTY_ACTIVITY_QUESTIONNAIRE,
    EMPTY_ACTIVITY_REGISTRATION_ANSWERS,
    emptyActivityAnswerValues,
    type ActivityQuestionnaire,
    type ActivityRegistrationAnswers,
} from "$lib/activity-questionnaire";
import {
    cleanCoordinatorAttendanceParticipantKey,
    isCoordinatorAttendanceCheckOutTime,
    type CoordinatorAttendanceRecordsFilters,
} from "$lib/coordinator-attendance-records";
import type { ClientDirectorySort } from "$lib/client-directory";
import type { DropdownSearchItem } from "$lib/dropdown-search";
import {
    normalizeGenderForStorage,
    projectMemberGenderForStorage,
    restoreMemberGender,
} from "$lib/gender";
import {
    FSII_OTHER_GENDER_MAX_LENGTH,
    isFsiiAccessibilityDifficulty,
    isFsiiIndigenousIdentity,
    isGradeInSchool,
    isIsoCalendarDate,
    isIsoCalendarMonth,
} from "$lib/fsii-member-demographics";
import {
    interestGroupReportDateRange,
    type InterestGroupReportPeriod,
    type InterestGroupYearlyReportRow,
} from "$lib/interest-group-report";
import { addBusinessDateDays, currentBusinessYear, parseBusinessSqlDateTime } from "$lib/local-date";
import { cleanMembershipYear } from "$lib/membership-year";
import { isValidUserPermissions } from "$lib/permissions";
import {
    isAttendanceUndoAllowed,
    type AttendanceCheckResult,
} from "$lib/member-attendance";
import * as m from "$lib/paraglide/messages";
import { normalizeProjectName } from "$lib/projects";
import { isValidCanadianPostalCode, normalizeCanadianPostalCode } from "$lib/postal-code";
import { isValidEmail } from "$lib/email";
import {
    isOrganizationReceiptPaymentType,
    MEMBERSHIP_FEE_PAYMENT_TYPE,
    OTHER_PAYMENT_TYPE,
} from "$lib/receipt-payment-types";
import {
    isResidentialStatus,
    normalizeResidentialStatusForStorage,
    normalizeResidentialStatusValue,
} from "$lib/residential-status";
import type { SsoAccessStatus } from "$lib/sso-access-status";
import {
    buildChineseNameSearchIndex,
    buildChineseNameSearchQuery,
    type ChineseNameSearchQuery,
} from "$lib/server/client-name-index";
import {
    type AppDb,
    getLastInsertId,
    nowSqlDate,
    nowSqlDateTime,
    rawAll,
    rawBatch,
    rawFirst,
    rawRun,
    toSqlDate,
    toSqlDateTime,
} from "$lib/server/db";
import { MAX_ACTIVITY_EDIT_REVISION, schema } from "$lib/server/db-schema";
import { buildActivityCapacityIncreaseStatements } from "$lib/server/public-activity-registration";
import {
    buildSessionAttendanceSuccessResult,
    resolveSessionAttendanceDuplicateResult,
    type MemberAttendanceSessionRegisterResult,
} from "$lib/server/member-attendance-session";
import {
    buildInterestGroupDuplicateReminder,
    resolveInterestGroupDuplicateCheckInAction,
} from "$lib/server/interest-group-attendance";
import {
    currentYear,
    getMembershipState,
} from "$lib/membership-year-status";
import {
    formatLegalNameFirstLast,
    sqliteNormalizedFirstLastNameExpression,
} from "$lib/server/legal-name";
import {
    childMemberSearchLikeExpression,
    clientSearchLikeExpression,
    organizationSearchLikeExpression,
} from "$lib/server/payer-search";
import {
    findTemporaryParticipantDuplicate,
    getActiveTemporaryParticipantByCode,
    getTemporaryParticipantById,
} from "$lib/server/temporary-participants";
import {
    cleanTemporaryParticipantLegalName,
    DOB_AGE_ONLY_MAX,
    DOB_AGE_ONLY_MIN,
    formatTemporaryParticipantLegalName,
    normalizeTemporaryParticipantLegalName,
    normalizeTemporaryParticipantStructuredName,
    parseDobAgeYears,
    parseTemporaryParticipantCode,
    resolveDobAgeWriteValues,
    validateTemporaryParticipantInput,
    type DobAgePreviousState,
    type TemporaryParticipantInput,
} from "$lib/temporary-participant";

export type { MemberAttendanceSessionRegisterResult } from "$lib/server/member-attendance-session";

export type UserRecord = {
    id: number;
    sso_subject: string;
    username: string;
    display_name: string | null;
    permissions: number;
    status: "active" | "disabled";
    sso_access_status: SsoAccessStatus;
    sso_synced_at: string | null;
    created_at: string;
};

export class DomainValidationError extends Error {}

type ReceiptPayerType = "client" | "child_member" | "organization";
type ReceiptPayerIdentity = {
    payerType: ReceiptPayerType;
    payerId: number;
};
type ReceiptDesignatedPersonValidationOptions = {
    allowInactiveDesignatedPersonId?: number | null;
    allowInactivePayer?: ReceiptPayerIdentity | null;
};

export type ClientFormInput = {
    clientCode: string;
    clientType: "Member";
    membershipType: "General" | "Lifetime";
    registrationDate: string;
    firstName: string;
    lastName: string;
    legalNamePhotoIdVerified: boolean;
    englishName: string;
    chineseName: string;
    gender: string;
    otherGender: string;
    dob: string;
    dobAgeOnly?: boolean | null;
    dobAge?: string | null;
    cob: string;
    birthProvince: string;
    birthCity: string;
    residentialStatus: string;
    isVolunteer: boolean;
    address: string;
    community: string;
    postalCode: string;
    tel: string;
    email: string;
    wechatID: string;
    emergencyContactPerson: string;
    emergencyContactRelationship: string;
    emergencyContactTel: string;
    referrerName: string;
    directorName: string;
    approverName: string;
    majorLanguage: string;
    populationGroup: string;
    maritalStatus: string;
    housingSituation: string;
    primaryIncome: string;
    gradeInSchool: string;
    numberChild: number;
    numberAdult: number;
    highestGrade: string;
    educationLevel: string;
    indigenousIdentity: string;
    arrivalMonth: string;
    physicalAccessibilityDifficulty: string;
    cognitiveDifficulty: string;
    emotionalMentalHealthCondition: string;
    remark: string;
};

export type ClientRecord = ClientFormInput & {
    id: number;
    // Read-only: populated from the DB row for detail views; the FSII upload
    // log is the only writer, form input can no longer set it.
    fsiiRegistrationDate: string;
    qrCodeKey: string | null;
    status: "active" | "disabled";
    // View-model age columns: "" when the record stores a full date of birth.
    ageYears: string;
    ageUpdatedDate: string;
};

export type ChildMemberFormInput = {
    childCode: string;
    membershipType: "General" | "Lifetime";
    membershipExpiryDate: string;
    registrationDate: string;
    firstName: string;
    lastName: string;
    englishName: string;
    chineseName: string;
    gender: string;
    dob: string;
    cob: string;
    residentialStatus: string;
    yearOfArrival: number | null;
    community: string;
    postalCode: string;
    tel: string;
    email: string;
    wechatID: string;
    emergencyContactPerson: string;
    emergencyContactTel: string;
    parentType: "member" | "temporary" | "inline" | "legacy";
    parentClientId: number | null;
    parentTemporaryParticipantId: number | null;
    parentName: string;
    parentContact: string;
    parentInlineFirstName: string;
    parentInlineLastName: string;
    parentInlineGender: "Male" | "Female" | "Other" | "";
    parentInlineDob: string;
    parentInlineTel: string;
    parentInlineEmail: string;
    majorLanguage: string;
    populationGroup: string;
    maritalStatus: string;
    housingSituation: string;
    primaryIncome: string;
    numberChild: number;
    numberAdult: number;
    highestGrade: string;
    educationLevel: string;
    accessibilityQ1: string;
    accessibilityQ2: string;
    accessibilityQ3: string;
    remark: string;
};

export type ChildMemberRecord = ChildMemberFormInput & {
    id: number;
    parentClientCode: string;
    parentClientChineseName: string;
    parentClientEnglishName: string;
    parentClientStatus: "active" | "disabled" | "";
    parentTemporaryParticipantCode: string;
    parentTemporaryParticipantLegalName: string;
    parentTemporaryParticipantStatus: "active" | "disabled" | "";
    status: "active" | "disabled";
};

export type OrganizationContactInput = {
    chineseName: string;
    englishName: string;
    tel: string;
    email: string;
    wechatID: string;
};

export type OrganizationContactRecord = OrganizationContactInput & {
    id: number;
};

export type OrganizationFormInput = {
    organizationCode: string;
    registrationDate: string;
    englishName: string;
    chineseName: string;
    community: string;
    postalCode: string;
    tel: string;
    email: string;
    wechatID: string;
    website: string;
    remark: string;
    contacts: OrganizationContactInput[];
};

export type OrganizationRecord = OrganizationFormInput & {
    id: number;
    status: "active" | "disabled";
    contacts: OrganizationContactRecord[];
};

export type OrganizationListItem = {
    id: number;
    organizationCode: string;
    chineseName: string;
    englishName: string;
    primaryContact: string | null;
    contactCount: number;
    lastPayment: string | null;
    status: string;
};

export type ClientListItem = {
    id: number;
    clientCode: string;
    clientType: string;
    membershipType: string;
    displayName: string;
    chineseName: string;
    englishName: string | null;
    lastPayment: string | null;
    lastMembershipYear: number | null;
    status: string;
};

export type ChildMemberListItem = {
    id: number;
    childCode: string;
    membershipType: string;
    chineseName: string;
    englishName: string | null;
    lastPayment: string | null;
    lastMembershipYear: number | null;
    status: string;
};

export type ReceiptFormInput = {
    payerClientId: number | null;
    payerChildMemberId: number | null;
    payerOrganizationId: number | null;
    paymentType: string;
    paymentMethod: string;
    issueDate: string;
    membershipYear: number | null;
    amount: number;
    currency: string;
    designatedPersonId: number | null;
    remark: string;
};

export type ReceiptListItem = {
    id: number;
    receiptNo: string;
    payerClientId: number | null;
    payerChildMemberId: number | null;
    payerOrganizationId: number | null;
    payerType: "client" | "child_member" | "organization" | null;
    payerId: number | null;
    payerCode: string | null;
    payerChineseName: string | null;
    payerEnglishName: string | null;
    payerLabel: string;
    issueDate: string;
    membershipYear: number | null;
    currency: string;
    amount: number;
    paymentType: string;
    paymentMethod: string;
    designatedPersonId: number | null;
    designatedPerson: string;
    remark: string | null;
    status: string;
    attachmentAssetId: number | null;
};

export type ReceiptDetail = ReceiptListItem & {
    clientCode: string | null;
    clientType: string | null;
    membershipType: string | null;
    attachmentName: string | null;
    attachmentKey: string | null;
    updatedAt: string;
};

export type ActivityFormInput = {
    name: string;
    description: string;
    projectId: number | null;
    heldAt: string | null;
    expectedParticipants: number;
    waitlistPercentage: number;
    requireRegistrationForCheckIn: boolean;
    integrityEnabled: boolean;
    questions: ActivityQuestionnaire;
    imageAssetId?: number | null;
    /** Set only by the edit form when preserving an existing non-canonical project link. */
    preserveExistingProjectId?: boolean;
};

export type ActivityListItem = {
    id: number;
    name: string;
    description: string | null;
    project_id: number | null;
    image_asset_id: number | null;
    held_at: string | null;
    expected_participants: number;
    waitlist_percentage: number;
    require_registration_for_check_in: boolean;
    status: "active" | "disabled";
    edit_revision: number;
    created_at: string;
    updated_at: string;
    registration_count: number;
    attendance_count: number;
};

export type ActivityDetail = ActivityListItem & {
    original_name: string | null;
    r2_key: string | null;
    integrity_enabled: boolean;
    questions: ActivityQuestionnaire;
    waitlist_count: number;
};

export type ActivityUpdateOutcome =
    | { status: "updated"; revision: number }
    | { status: "not_found" }
    | { status: "conflict"; currentRevision: number }
    | { status: "invalid_project" }
    | { status: "integrity_locked" }
    | { status: "capacity_too_low"; activeRegistrationCount: number }
    | { status: "revision_ceiling" }
    | { status: "unconfirmed" };

export type ProjectDeleteOutcome =
    | { status: "deleted" }
    | { status: "not_found" }
    | { status: "revision_ceiling" }
    | { status: "unconfirmed" };

export type ActivityUpdateOutcomeClassifier = (
    db: AppDb,
    input: ActivityConditionalUpdateInput,
    options: { allowConfirmedSuccess: boolean },
) => Promise<ActivityUpdateOutcome>;

export type ActivityParticipantRecord = {
    id: number;
    participantKey: string;
    clientId: number | null;
    childMemberId: number | null;
    temporaryParticipantId: number | null;
    clientCode: string;
    chineseName: string;
    englishName: string | null;
    registrationStatus: "active" | "waitlisted";
    registeredAt: string | null;
    waitlistedAt: string | null;
    answers: ActivityRegistrationAnswers;
    fsiiSurveyCompletedThisYear?: boolean;
};

export type ActivityAttendanceRecord = {
    id: number;
    participantKey: string;
    clientId: number | null;
    childMemberId: number | null;
    temporaryParticipantId: number | null;
    clientCode: string;
    chineseName: string;
    englishName: string | null;
    registeredAt: string | null;
    attendedAt: string;
    status: string;
    wasRegisteredWhenAttended: boolean;
    latestFsiiSurveyDate: string | null;
    fsiiSurveyCompletedThisYear?: boolean;
};

export type ActivityManualEntryRecord = {
    id: number;
    clientId: number | null;
    childMemberId: number | null;
    clientCode: string;
    chineseName: string;
    englishName: string | null;
    registeredAt: string | null;
    attendedAt: string;
    status: string;
    wasRegisteredWhenAttended?: boolean;
    fsiiSurveyCompletedThisYear: boolean;
};

export type ActivityAttendanceCounters = {
    registrationTotal: number;
    attendanceTotal: number;
    walkInTotal: number;
};

export type ActivityAttendanceSnapshot = {
    records: ActivityAttendanceRecord[];
    counters: ActivityAttendanceCounters;
};

export type InterestGroupRecord = {
    id: number;
    name: string;
    defaultAttendanceDate: string | null;
    status: string;
};

export type InterestGroupAttendanceRecord = {
    id: number;
    clientId: number | null;
    childMemberId: number | null;
    clientCode: string;
    chineseName: string;
    englishName: string | null;
    attendedAt: string;
    status: string;
    fsiiSurveyCompletedThisYear: boolean;
};

export type MemberAttendanceSessionRecord = {
    id: number;
    clientId: number | null;
    childMemberId: number | null;
    clientCode: string;
    chineseName: string;
    englishName: string | null;
    attendedAt: string;
    checkedOutAt: string | null;
    status: string;
};

export type InterestGroupAttendanceRegisterResult = {
    checkResult: AttendanceCheckResult;
    message: string;
    silent?: boolean;
    reminder?: {
        timeoutSeconds: number;
    };
};

export type AttendanceCounters = {
    todayTotal: number;
    monthTotal: number;
};

export type ProjectListItem = {
    id: number;
    name: string;
    status: "active" | "disabled";
    createdAt: string;
    updatedAt: string;
};

export type InterestGroupAttendanceSnapshot = {
    records: InterestGroupAttendanceRecord[];
    counters: AttendanceCounters;
};

export type InterestGroupMonthlyReportRow = {
    id: number;
    name: string;
    attendanceCount: number;
    uniqueMemberCount: number;
};

export type CoordinatorAttendanceRecord = MemberAttendanceSessionRecord;

export type CoordinatorAttendanceSnapshot = {
    records: CoordinatorAttendanceRecord[];
    counters: AttendanceCounters;
};

export type CoordinatorAttendanceRecordsRow = {
    id: number;
    participantKey: string;
    clientCode: string;
    name: string;
    englishName: string | null;
    attendanceDate: string;
    attendedAt: string;
    checkedOutAt: string | null;
};

export type CoordinatorAttendanceRecordsResult = {
    rows: CoordinatorAttendanceRecordsRow[];
    total: number;
};

export type CoordinatorAttendanceParticipantOption = {
    id: string;
    value: string;
    participantKey: string;
    clientCode: string;
    title: string;
    label: string;
    chineseName: string;
    englishName: string | null;
    param_dict: Record<string, string>;
};

function mapMemberSearchItem(row: {
    id: number;
    client_code: string;
    first_name?: string | null;
    last_name?: string | null;
    chinese_name: string | null;
    english_name: string | null;
}, options: { includeLegalName?: boolean } = {}): DropdownSearchItem {
    const chineseName = row.chinese_name?.trim() ?? "";
    const legalName = formatLegalNameFirstLast(row.first_name, row.last_name);
    const englishName = memberDisplayEnglishName({
        englishName: row.english_name,
        firstName: row.first_name,
        lastName: row.last_name,
    });
    const displayName = memberDisplayName({
        code: row.client_code,
        chineseName,
        englishName,
    });
    const englishSuffix = chineseName && englishName ? ` / ${englishName}` : "";
    const label = `${displayName}${englishSuffix} (${row.client_code})`;
    const item: DropdownSearchItem = {
        id: row.id,
        value: row.client_code,
        clientCode: row.client_code,
        title: label,
        label,
        param_dict: {
            clientCode: row.client_code,
            chineseName,
            ...(englishName ? { englishName } : {}),
        },
        chineseName,
        englishName,
    };

    if (options.includeLegalName) {
        item.legalName = legalName;
    }

    return item;
}

function memberDisplayEnglishName(input: {
    englishName: string | null | undefined;
    firstName?: string | null | undefined;
    lastName?: string | null | undefined;
}): string | null {
    return input.englishName?.trim() || formatLegalNameFirstLast(input.firstName, input.lastName);
}

function memberDisplayName(input: {
    code: string;
    chineseName: string | null;
    englishName: string | null;
}): string {
    return input.chineseName?.trim() || input.englishName?.trim() || input.code;
}

function clientColumn(alias: string, column: string): string {
    return alias ? `${alias}.${column}` : column;
}

function repeatedSearchCondition(
    query: ChineseNameSearchQuery,
    buildCondition: () => string,
): string {
    if (query.likePatterns.length === 0) return "0";
    return query.likePatterns.map(() => `(${buildCondition()})`).join("\n            OR ");
}

function repeatedExactCondition(
    query: ChineseNameSearchQuery,
    buildCondition: () => string,
): string {
    if (query.variants.length === 0) return "0";
    return query.variants.map(() => `(${buildCondition()})`).join("\n            OR ");
}

function clientSearchLikeCondition(alias: string, query: ChineseNameSearchQuery): string {
    return repeatedSearchCondition(
        query,
        () => `
                ${clientColumn(alias, "client_code")} LIKE ?
                OR COALESCE(${clientColumn(alias, "chinese_name")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${clientColumn(alias, "english_name")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${clientColumn(alias, "first_name")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${clientColumn(alias, "last_name")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${clientColumn(alias, "chinese_name_pinyin")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${clientColumn(alias, "chinese_name_pinyin_compact")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${clientColumn(alias, "chinese_name_pinyin_initials")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${clientColumn(alias, "chinese_name_pinyin_given_surname")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${clientColumn(alias, "chinese_name_search_terms")}, '') LIKE ? COLLATE NOCASE
        `,
    );
}

function clientSearchLikeParams(query: ChineseNameSearchQuery): string[] {
    return query.likePatterns.flatMap((searchLike) => [
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
    ]);
}

function clientSearchExactCondition(alias: string, query: ChineseNameSearchQuery): string {
    return repeatedExactCondition(
        query,
        () => `
                UPPER(${clientColumn(alias, "client_code")}) = UPPER(?)
                OR COALESCE(${clientColumn(alias, "chinese_name")}, '') = ?
                OR LOWER(COALESCE(${clientColumn(alias, "english_name")}, '')) = LOWER(?)
                OR LOWER(COALESCE(${clientColumn(alias, "first_name")}, '')) = LOWER(?)
                OR LOWER(COALESCE(${clientColumn(alias, "last_name")}, '')) = LOWER(?)
                OR LOWER(COALESCE(${clientColumn(alias, "chinese_name_pinyin")}, '')) = LOWER(?)
                OR LOWER(COALESCE(${clientColumn(alias, "chinese_name_pinyin_compact")}, '')) = LOWER(?)
                OR LOWER(COALESCE(${clientColumn(alias, "chinese_name_pinyin_initials")}, '')) = LOWER(?)
                OR LOWER(COALESCE(${clientColumn(alias, "chinese_name_pinyin_given_surname")}, '')) = LOWER(?)
                OR COALESCE(${clientColumn(alias, "chinese_name_search_terms")}, '') LIKE ? COLLATE NOCASE
        `,
    );
}

function clientSearchExactParams(query: ChineseNameSearchQuery): Array<string | null> {
    return query.variants.flatMap((search, index) => [
        search,
        search,
        search,
        search,
        search,
        search,
        search,
        search,
        search,
        query.exactTermPatterns[index] ?? null,
    ]);
}

function clientSearchRankParams(query: ChineseNameSearchQuery): Array<string | null> {
    const search = query.variants[0] ?? "";
    return [
        search,
        search,
        search,
        search,
        search,
        search,
        search,
        search,
        search,
        query.exactTermPatterns[0] ?? null,
    ];
}

function organizationColumn(alias: string, column: string): string {
    return alias ? `${alias}.${column}` : column;
}

function organizationSearchLikeCondition(alias: string, query: ChineseNameSearchQuery): string {
    return repeatedSearchCondition(
        query,
        () => `
                ${organizationColumn(alias, "organization_code")} LIKE ?
                OR ${organizationColumn(alias, "chinese_name")} LIKE ?
                OR ${organizationColumn(alias, "english_name")} LIKE ? COLLATE NOCASE
                OR COALESCE(${organizationColumn(alias, "chinese_name_pinyin")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${organizationColumn(alias, "chinese_name_pinyin_compact")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${organizationColumn(alias, "chinese_name_pinyin_initials")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${organizationColumn(alias, "chinese_name_pinyin_given_surname")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${organizationColumn(alias, "chinese_name_search_terms")}, '') LIKE ? COLLATE NOCASE
        `,
    );
}

function organizationSearchLikeParams(query: ChineseNameSearchQuery): string[] {
    return query.likePatterns.flatMap((searchLike) => [
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
    ]);
}

function organizationContactSearchLikeCondition(
    alias: string,
    query: ChineseNameSearchQuery,
): string {
    const column = (name: string) => `${alias}.${name}`;
    return repeatedSearchCondition(
        query,
        () => `
                ${column("chinese_name")} LIKE ?
                OR ${column("english_name")} LIKE ? COLLATE NOCASE
                OR COALESCE(${column("tel")}, '') LIKE ?
                OR COALESCE(${column("email")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${column("wechat_id")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${column("chinese_name_search_terms")}, '') LIKE ? COLLATE NOCASE
        `,
    );
}

function organizationContactSearchLikeParams(query: ChineseNameSearchQuery): string[] {
    return query.likePatterns.flatMap((searchLike) => [
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
    ]);
}

function childMemberColumn(alias: string, column: string): string {
    return alias ? `${alias}.${column}` : column;
}

function childMemberSearchLikeCondition(alias: string, query: ChineseNameSearchQuery): string {
    return repeatedSearchCondition(
        query,
        () => `
                ${childMemberColumn(alias, "child_code")} LIKE ?
                OR ${childMemberColumn(alias, "chinese_name")} LIKE ?
                OR ${childMemberColumn(alias, "english_name")} LIKE ? COLLATE NOCASE
                OR COALESCE(${childMemberColumn(alias, "chinese_name_pinyin")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${childMemberColumn(alias, "chinese_name_pinyin_compact")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${childMemberColumn(alias, "chinese_name_pinyin_initials")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${childMemberColumn(alias, "chinese_name_pinyin_given_surname")}, '') LIKE ? COLLATE NOCASE
                OR COALESCE(${childMemberColumn(alias, "chinese_name_search_terms")}, '') LIKE ? COLLATE NOCASE
        `,
    );
}

function childMemberSearchLikeParams(query: ChineseNameSearchQuery): string[] {
    return query.likePatterns.flatMap((searchLike) => [
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
    ]);
}

function childMemberSearchExactCondition(alias: string, query: ChineseNameSearchQuery): string {
    return repeatedExactCondition(
        query,
        () => `
                UPPER(${childMemberColumn(alias, "child_code")}) = UPPER(?)
                OR ${childMemberColumn(alias, "chinese_name")} = ?
                OR LOWER(COALESCE(${childMemberColumn(alias, "english_name")}, '')) = LOWER(?)
                OR LOWER(COALESCE(${childMemberColumn(alias, "chinese_name_pinyin")}, '')) = LOWER(?)
                OR LOWER(COALESCE(${childMemberColumn(alias, "chinese_name_pinyin_compact")}, '')) = LOWER(?)
                OR LOWER(COALESCE(${childMemberColumn(alias, "chinese_name_pinyin_initials")}, '')) = LOWER(?)
                OR LOWER(COALESCE(${childMemberColumn(alias, "chinese_name_pinyin_given_surname")}, '')) = LOWER(?)
                OR COALESCE(${childMemberColumn(alias, "chinese_name_search_terms")}, '') LIKE ? COLLATE NOCASE
        `,
    );
}

function childMemberSearchExactParams(query: ChineseNameSearchQuery): Array<string | null> {
    return query.variants.flatMap((search, index) => [
        search,
        search,
        search,
        search,
        search,
        search,
        search,
        query.exactTermPatterns[index] ?? null,
    ]);
}

function normalizeText(value: FormDataEntryValue | null): string {
    return value?.toString().trim() ?? "";
}

function normalizeNullableText(value: FormDataEntryValue | null): string | null {
    const text = normalizeText(value);
    return text.length > 0 ? text : null;
}

function normalizeInteger(value: FormDataEntryValue | null): number {
    const parsed = Number(normalizeText(value));
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeNonNegativeIntegerOrNull(value: FormDataEntryValue | null): number | null {
    const text = normalizeText(value);
    if (!text) return null;
    const parsed = Number(text);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizePositiveIntegerOrNull(value: FormDataEntryValue | null): number | null {
    const parsed = normalizeInteger(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeCheckbox(value: FormDataEntryValue | null): boolean {
    return ["1", "true", "on", "yes"].includes(normalizeText(value).toLowerCase());
}

function genderForStorage(value: string): ReturnType<typeof normalizeGenderForStorage> {
    try {
        return normalizeGenderForStorage(value);
    } catch {
        throw new DomainValidationError(m.genderInvalid());
    }
}

function memberGenderForStorage(value: string): ReturnType<typeof projectMemberGenderForStorage> {
    try {
        return projectMemberGenderForStorage(value);
    } catch {
        throw new DomainValidationError(m.memberGenderInvalid());
    }
}

function residentialStatusForStorage(
    value: string,
): ReturnType<typeof normalizeResidentialStatusForStorage> {
    try {
        return normalizeResidentialStatusForStorage(value);
    } catch {
        throw new DomainValidationError(m.residentialStatusInvalid());
    }
}

function buildNullableChineseNameSearchIndex(name: string) {
    return name
        ? buildChineseNameSearchIndex(name)
        : {
            pinyin: null,
            pinyinCompact: null,
            pinyinInitials: null,
            pinyinGivenSurname: null,
            searchTerms: null,
        };
}

export function validateClientForSave(
    input: ClientFormInput,
    {
        requireLegalName = true,
        allowMissingRequired = false,
    }: {
        requireLegalName?: boolean;
        allowMissingRequired?: boolean;
    } = {},
): void {
    if (!allowMissingRequired && requireLegalName && (!input.firstName || !input.lastName)) {
        throw new DomainValidationError(m.clientLegalNameRequired());
    }
    if (!allowMissingRequired && !input.gender) {
        throw new DomainValidationError(m.clientGenderRequired());
    }
    if (
        (!allowMissingRequired && !input.residentialStatus) ||
        (input.residentialStatus && !isResidentialStatus(input.residentialStatus))
    ) {
        throw new DomainValidationError(m.clientResidentialStatusRequired());
    }
    if (!allowMissingRequired && !input.cob) {
        throw new DomainValidationError(m.clientCountryOfBirthRequired());
    }
    if (input.dobAgeOnly) {
        // Age mode: dob is required to be absent server-side (residual values
        // are ignored); the age itself must be a whole number 0..120.
        if (parseDobAgeYears(input.dobAge) === null) {
            throw new DomainValidationError(
                m.clientDobAgeInvalid({ min: DOB_AGE_ONLY_MIN, max: DOB_AGE_ONLY_MAX }),
            );
        }
    } else if (!allowMissingRequired && !input.dob) {
        throw new DomainValidationError(m.clientDobRequired());
    }
    if (!allowMissingRequired && !input.emergencyContactPerson) {
        throw new DomainValidationError(m.clientEmergencyContactRequired());
    }
    if (!allowMissingRequired && !input.emergencyContactRelationship) {
        throw new DomainValidationError(m.clientEmergencyContactRelationshipRequired());
    }
    if (!allowMissingRequired && !input.emergencyContactTel) {
        throw new DomainValidationError(m.clientEmergencyContactTelRequired());
    }
    if (!allowMissingRequired && !input.referrerName) {
        throw new DomainValidationError(m.clientReferrerRequired());
    }
    if (!isValidCanadianPostalCode(input.postalCode)) {
        throw new DomainValidationError(m.postalCodeInvalid());
    }
    if (!isValidEmail(input.email)) {
        throw new DomainValidationError(m.emailInvalid());
    }
    if (input.gender && !memberGenderForStorage(input.gender).gender) {
        throw new DomainValidationError(m.memberGenderInvalid());
    }
    if (input.gradeInSchool && !isGradeInSchool(input.gradeInSchool)) {
        throw new DomainValidationError(m.gradeInSchoolInvalid());
    }
    if (
        input.gender === "Other" &&
        input.otherGender.length > FSII_OTHER_GENDER_MAX_LENGTH
    ) {
        throw new DomainValidationError(m.otherGenderInvalid());
    }
    if (input.indigenousIdentity && !isFsiiIndigenousIdentity(input.indigenousIdentity)) {
        throw new DomainValidationError(m.indigenousIdentityInvalid());
    }
    if (input.arrivalMonth && !isIsoCalendarMonth(input.arrivalMonth)) {
        throw new DomainValidationError(m.arrivalMonthInvalid());
    }
    for (const accessibilityValue of [
        input.physicalAccessibilityDifficulty,
        input.cognitiveDifficulty,
        input.emotionalMentalHealthCondition,
    ]) {
        if (accessibilityValue && !isFsiiAccessibilityDifficulty(accessibilityValue)) {
            throw new DomainValidationError(m.accessibilityDifficultyInvalid());
        }
    }
}

function getClientCodePrefix(): string {
    return "SCSC";
}

function formatClientCode(prefix: string, numericId: number): string {
    return `${prefix}${numericId.toString().padStart(4, "0")}`;
}

function formatReceiptNo(numericId: number): string {
    return `RCPT${numericId.toString().padStart(4, "0")}`;
}

export function parseClientFormData(formData: FormData): ClientFormInput {
    return {
        clientCode: normalizeText(formData.get("clientCode")),
        clientType: "Member",
        membershipType:
            (normalizeText(
                formData.get("membershipType"),
            ) as ClientFormInput["membershipType"]) || "General",
        registrationDate: normalizeText(formData.get("registrationDate")) || nowSqlDate(),
        firstName: normalizeText(formData.get("firstName")),
        lastName: normalizeText(formData.get("lastName")),
        legalNamePhotoIdVerified: normalizeCheckbox(
            formData.get("legalNamePhotoIdVerified"),
        ),
        englishName: normalizeText(formData.get("englishName")),
        chineseName: normalizeText(formData.get("chineseName")),
        gender: normalizeText(formData.get("gender")),
        otherGender: normalizeText(formData.get("otherGender")),
        dob: normalizeText(formData.get("dob")),
        dobAgeOnly: formData.has("dobAgeOnly"),
        dobAge: normalizeText(formData.get("dobAge")),
        cob: normalizeText(formData.get("cob")),
        birthProvince: normalizeText(formData.get("birthProvince")),
        birthCity: normalizeText(formData.get("birthCity")),
        residentialStatus: normalizeResidentialStatusValue(formData.get("residentialStatus")?.toString()),
        isVolunteer: normalizeCheckbox(formData.get("isVolunteer")),
        address: normalizeText(formData.get("address")),
        community: normalizeText(formData.get("community")),
        postalCode: normalizeCanadianPostalCode(formData.get("postalCode")?.toString()),
        tel: normalizeText(formData.get("tel")),
        email: normalizeText(formData.get("email")),
        wechatID: normalizeText(formData.get("wechatID")),
        emergencyContactPerson: normalizeText(formData.get("emergencyContactPerson")),
        emergencyContactRelationship: normalizeText(formData.get("emergencyContactRelationship")),
        emergencyContactTel: normalizeText(formData.get("emergencyContactTel")),
        referrerName: normalizeText(formData.get("referrerName")),
        directorName: normalizeText(formData.get("directorName")),
        approverName: normalizeText(formData.get("approverName")),
        majorLanguage: normalizeText(formData.get("majorLanguage")),
        populationGroup: normalizeText(formData.get("populationGroup")),
        maritalStatus: normalizeText(formData.get("maritalStatus")),
        housingSituation: normalizeText(formData.get("housingSituation")),
        primaryIncome: normalizeText(formData.get("primaryIncome")),
        gradeInSchool: normalizeText(formData.get("gradeInSchool")),
        numberChild: normalizeInteger(formData.get("numberChild")),
        numberAdult: normalizeInteger(formData.get("numberAdult")),
        highestGrade: normalizeText(formData.get("highestGrade")),
        educationLevel: normalizeText(formData.get("educationLevel")),
        indigenousIdentity: normalizeText(formData.get("indigenousIdentity")),
        arrivalMonth: normalizeText(formData.get("arrivalMonth")),
        physicalAccessibilityDifficulty: normalizeText(formData.get("physicalAccessibilityDifficulty")),
        cognitiveDifficulty: normalizeText(formData.get("cognitiveDifficulty")),
        emotionalMentalHealthCondition: normalizeText(formData.get("emotionalMentalHealthCondition")),
        remark: normalizeText(formData.get("remark")),
    };
}

export function parseChildMemberFormData(formData: FormData): ChildMemberFormInput {
    const membershipType = normalizeText(formData.get("membershipType"));
    const parentTypeValue = normalizeText(formData.get("parentType"));
    const parentType: ChildMemberFormInput["parentType"] =
        parentTypeValue === "member" ||
            parentTypeValue === "temporary" ||
            parentTypeValue === "inline"
            ? parentTypeValue
            : "legacy";
    return {
        childCode: normalizeText(formData.get("childCode")),
        membershipType: membershipType === "Lifetime" ? "Lifetime" : "General",
        membershipExpiryDate: normalizeText(formData.get("membershipExpiryDate")),
        registrationDate: normalizeText(formData.get("registrationDate")) || nowSqlDate(),
        firstName: normalizeText(formData.get("firstName")),
        lastName: normalizeText(formData.get("lastName")),
        englishName: normalizeText(formData.get("englishName")),
        chineseName: normalizeText(formData.get("chineseName")),
        gender: normalizeText(formData.get("gender")),
        dob: normalizeText(formData.get("dob")),
        cob: normalizeText(formData.get("cob")),
        residentialStatus: normalizeText(formData.get("residentialStatus")),
        yearOfArrival: normalizeNonNegativeIntegerOrNull(formData.get("yearOfArrival")),
        community: normalizeText(formData.get("community")),
        postalCode: normalizeCanadianPostalCode(formData.get("postalCode")?.toString()),
        tel: normalizeText(formData.get("tel")),
        email: normalizeText(formData.get("email")),
        wechatID: normalizeText(formData.get("wechatID")),
        emergencyContactPerson: normalizeText(formData.get("emergencyContactPerson")),
        emergencyContactTel: normalizeText(formData.get("emergencyContactTel")),
        parentType,
        parentClientId: normalizePositiveIntegerOrNull(formData.get("parentClientId")),
        parentTemporaryParticipantId: normalizePositiveIntegerOrNull(
            formData.get("parentTemporaryParticipantId"),
        ),
        parentName: normalizeText(formData.get("parentName")),
        parentContact: normalizeText(formData.get("parentContact")),
        parentInlineFirstName: normalizeText(formData.get("parentInlineFirstName")),
        parentInlineLastName: normalizeText(formData.get("parentInlineLastName")),
        parentInlineGender: (() => {
            const value = normalizeText(formData.get("parentInlineGender"));
            return value === "Male" || value === "Female" || value === "Other" ? value : "";
        })(),
        parentInlineDob: normalizeText(formData.get("parentInlineDob")),
        parentInlineTel: normalizeText(formData.get("parentInlineTel")),
        parentInlineEmail: normalizeText(formData.get("parentInlineEmail")),
        majorLanguage: normalizeText(formData.get("majorLanguage")),
        populationGroup: normalizeText(formData.get("populationGroup")),
        maritalStatus: normalizeText(formData.get("maritalStatus")),
        housingSituation: normalizeText(formData.get("housingSituation")),
        primaryIncome: normalizeText(formData.get("primaryIncome")),
        numberChild: normalizeInteger(formData.get("numberChild")),
        numberAdult: normalizeInteger(formData.get("numberAdult")),
        highestGrade: normalizeText(formData.get("highestGrade")),
        educationLevel: normalizeText(formData.get("educationLevel")),
        accessibilityQ1: normalizeText(formData.get("accessibilityQ1")),
        accessibilityQ2: normalizeText(formData.get("accessibilityQ2")),
        accessibilityQ3: normalizeText(formData.get("accessibilityQ3")),
        remark: normalizeText(formData.get("remark")),
    };
}

export function parseOrganizationFormData(formData: FormData): OrganizationFormInput {
    const contactChineseNames = formData.getAll("contactChineseName");
    const contactEnglishNames = formData.getAll("contactEnglishName");
    const contactTels = formData.getAll("contactTel");
    const contactEmails = formData.getAll("contactEmail");
    const contactWechatIDs = formData.getAll("contactWechatID");
    const contactCount = Math.max(
        contactChineseNames.length,
        contactEnglishNames.length,
        contactTels.length,
        contactEmails.length,
        contactWechatIDs.length,
    );
    const contacts: OrganizationContactInput[] = [];

    for (let index = 0; index < contactCount; index += 1) {
        const contact = {
            chineseName: normalizeText(contactChineseNames[index] ?? null),
            englishName: normalizeText(contactEnglishNames[index] ?? null),
            tel: normalizeText(contactTels[index] ?? null),
            email: normalizeText(contactEmails[index] ?? null),
            wechatID: normalizeText(contactWechatIDs[index] ?? null),
        };

        if (
            contact.chineseName ||
            contact.englishName ||
            contact.tel ||
            contact.email ||
            contact.wechatID
        ) {
            contacts.push(contact);
        }
    }

    return {
        organizationCode: normalizeText(formData.get("organizationCode")),
        registrationDate: normalizeText(formData.get("registrationDate")) || nowSqlDate(),
        englishName: normalizeText(formData.get("englishName")),
        chineseName: normalizeText(formData.get("chineseName")),
        community: normalizeText(formData.get("community")),
        postalCode: normalizeCanadianPostalCode(formData.get("postalCode")?.toString()),
        tel: normalizeText(formData.get("tel")),
        email: normalizeText(formData.get("email")),
        wechatID: normalizeText(formData.get("wechatID")),
        website: normalizeText(formData.get("website")),
        remark: normalizeText(formData.get("remark")),
        contacts,
    };
}

function normalizeMembershipYear(value: FormDataEntryValue | null): number | null {
    return cleanMembershipYear(normalizeText(value));
}

export function parseReceiptFormData(formData: FormData): ReceiptFormInput {
    const payerKey = normalizeText(formData.get("payerKey"));
    const issueDate = normalizeText(formData.get("issueDate"));
    const amountText = normalizeText(formData.get("amount"));
    const [payerType, payerIdText] = payerKey.includes(":")
        ? payerKey.split(":", 2)
        : ["client", ""];
    const payerId = Number(payerIdText);
    const payerClientId =
        payerType === "client" && Number.isFinite(payerId) && payerId > 0
            ? payerId
            : null;
    const payerChildMemberId =
        payerType === "child_member" && Number.isFinite(payerId) && payerId > 0
            ? payerId
            : null;
    const payerOrganizationId =
        payerType === "organization" && Number.isFinite(payerId) && payerId > 0
            ? payerId
            : null;

    return {
        payerClientId,
        payerChildMemberId,
        payerOrganizationId,
        paymentType: normalizeText(formData.get("paymentType")),
        paymentMethod: normalizeText(formData.get("paymentMethod")),
        issueDate,
        membershipYear: normalizeMembershipYear(formData.get("membershipYear")),
        amount: amountText === "" ? Number.NaN : Number(amountText),
        currency: normalizeText(formData.get("currency")) || "CAD",
        designatedPersonId: normalizePositiveIntegerOrNull(formData.get("designatedPersonId")),
        remark: normalizeText(formData.get("remark")),
    };
}

export function parseActivityFormData(formData: FormData): ActivityFormInput {
    const longTerm = normalizeCheckbox(formData.get("longTerm"));
    return {
        name: normalizeText(formData.get("activityName")),
        description: normalizeText(formData.get("description")),
        projectId: normalizePositiveIntegerOrNull(formData.get("projectId")),
        heldAt: longTerm ? null : (toSqlDateTime(normalizeText(formData.get("heldAt"))) ?? ""),
        expectedParticipants: normalizePositiveIntegerOrNull(
            formData.get("expectedParticipants"),
        ) ?? 10,
        waitlistPercentage: normalizePositiveIntegerOrNull(
            formData.get("waitlistPercentage"),
        ) ?? 10,
        requireRegistrationForCheckIn: true,
        integrityEnabled: longTerm ? false : formData.get("integrityEnabled") === null
            ? true
            : normalizeCheckbox(formData.get("integrityEnabled")),
        questions: EMPTY_ACTIVITY_QUESTIONNAIRE,
        imageAssetId: null,
    };
}

export async function validateActivityForSave(
    db: AppDb,
    input: ActivityFormInput,
): Promise<void> {
    if (
        (input.heldAt === null && input.integrityEnabled) ||
        (input.heldAt !== null && toSqlDateTime(input.heldAt.replace(" ", "T").slice(0, 16)) === null)
    ) {
        throw new DomainValidationError(m.activityFieldsRequired());
    }
    if (!Number.isSafeInteger(input.expectedParticipants) || input.expectedParticipants <= 0) {
        throw new DomainValidationError(m.activityFieldsRequired());
    }
    if (
        !Number.isSafeInteger(input.waitlistPercentage) ||
        input.waitlistPercentage < 1 || input.waitlistPercentage > 100
    ) {
        throw new DomainValidationError(m.activityFieldsRequired());
    }
    if (input.projectId === null) return;
    if (!Number.isInteger(input.projectId) || input.projectId <= 0) {
        throw new DomainValidationError(m.projectMissingId());
    }
    const project = await getProject(db, input.projectId);
    if (!project) throw new DomainValidationError(m.projectMissingId());
}

export async function generateNextClientCode(
    db: AppDb,
): Promise<string> {
    const prefix = getClientCodePrefix();
    const rows = await db
        .select({ client_code: schema.clients.clientCode })
        .from(schema.clients)
        .where(like(schema.clients.clientCode, `${prefix}%`));

    const maxNumeric = rows.reduce((currentMax, row) => {
        const numeric = Number(row.client_code.replace(prefix, ""));
        return Number.isFinite(numeric) ? Math.max(currentMax, numeric) : currentMax;
    }, 0);

    return formatClientCode(prefix, maxNumeric + 1);
}

export async function generateNextChildMemberCode(db: AppDb): Promise<string> {
    const prefix = "R";
    const rows = await db
        .select({ child_code: schema.childMembers.childCode })
        .from(schema.childMembers)
        .where(like(schema.childMembers.childCode, `${prefix}%`));

    const maxNumeric = rows.reduce((currentMax, row) => {
        const numeric = Number(row.child_code.replace(prefix, ""));
        return Number.isFinite(numeric) ? Math.max(currentMax, numeric) : currentMax;
    }, 0);

    return formatClientCode(prefix, maxNumeric + 1);
}

export async function generateNextOrganizationCode(db: AppDb): Promise<string> {
    const prefix = "ORG";
    const rows = await db
        .select({ organization_code: schema.organizations.organizationCode })
        .from(schema.organizations)
        .where(like(schema.organizations.organizationCode, `${prefix}%`));

    const maxNumeric = rows.reduce((currentMax, row) => {
        const numeric = Number(row.organization_code.replace(prefix, ""));
        return Number.isFinite(numeric) ? Math.max(currentMax, numeric) : currentMax;
    }, 0);

    return formatClientCode(prefix, maxNumeric + 1);
}

export async function generateNextReceiptNo(db: AppDb): Promise<string> {
    const rows = await db
        .select({ receipt_no: schema.receipts.receiptNo })
        .from(schema.receipts)
        .where(like(schema.receipts.receiptNo, "RCPT%"));
    const maxNumeric = rows.reduce((currentMax, row) => {
        const numeric = Number(row.receipt_no.replace("RCPT", ""));
        return Number.isFinite(numeric) ? Math.max(currentMax, numeric) : currentMax;
    }, 0);
    return formatReceiptNo(maxNumeric + 1);
}

const GENERATED_CODE_MAX_ATTEMPTS = 3;

function isUniqueConstraintError(cause: unknown): boolean {
    const message = cause instanceof Error ? cause.message : String(cause);
    return /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|constraint failed.*UNIQUE/i.test(message);
}

export async function listUsers(db: AppDb): Promise<UserRecord[]> {
    const rows = await db
        .select({
            id: schema.users.id,
            ssoSubject: schema.users.ssoSubject,
            username: schema.users.username,
            displayName: schema.users.displayName,
            permissions: schema.users.permissions,
            status: schema.users.status,
            ssoAccessStatus: schema.users.ssoAccessStatus,
            ssoSyncedAt: schema.users.ssoSyncedAt,
            createdAt: schema.users.createdAt,
        })
        .from(schema.users)
        .orderBy(desc(schema.users.createdAt), desc(schema.users.id));

    return rows.map((row) => ({
        id: row.id,
        sso_subject: row.ssoSubject,
        username: row.username,
        display_name: row.displayName,
        permissions: row.permissions,
        status: row.status,
        sso_access_status: row.ssoAccessStatus,
        sso_synced_at: row.ssoSyncedAt,
        created_at: row.createdAt,
    }));
}

export async function updateUserPermissions(
    db: AppDb,
    userId: number,
    permissions: number,
): Promise<void> {
    if (!isValidUserPermissions(permissions)) {
        throw new Error("Invalid permissions");
    }

    const timestamp = nowSqlDateTime();
    await db
        .update(schema.users)
        .set({
            permissions,
            updatedAt: timestamp,
        })
        .where(eq(schema.users.id, userId));
}

export async function listClients(
    db: AppDb,
    options: {
        search?: string;
        clientType?: string;
        page: number;
        limit: number;
        membershipStatus?: MembershipStatusFilter;
        sort?: ClientDirectorySort;
    },
): Promise<{ rows: ClientListItem[]; total: number }> {
    const search = options.search?.trim() ?? "";
    const clientType = options.clientType?.trim() === "Member" ? "Member" : "";
    const page = Math.max(options.page, 1);
    const limit = Math.max(options.limit, 1);
    const offset = (page - 1) * limit;
    const searchQuery = buildChineseNameSearchQuery(search);
    const sort = options.sort ?? { sort: null, dir: "desc" };
    const sortDirection = sort.dir === "asc" ? "ASC" : "DESC";

    const filterSql = `
        WHERE c.client_type = 'Member'
          AND (? = '' OR c.client_type = ?)
          AND (
            ? = ''
            OR ${clientSearchLikeCondition("c", searchQuery)}
          )
    `;

    const mstat = options.membershipStatus ?? DEFAULT_MEMBERSHIP_STATUS_FILTER;
    // Disabled is an independent state and is excluded by default.
    const currentYear = Number(nowSqlDate().slice(0, 4));
    const prevYear = currentYear - 1;
    const il = mstat.includeLifetime ? 1 : 0;
    const ia = mstat.includeActive ? 1 : 0;
    const iw = mstat.includeWarning ? 1 : 0;
    const ie = mstat.includeExpired ? 1 : 0;
    const id = mstat.includeDisabled ? 1 : 0;

    const innerBinds: (string | number)[] = [
        clientType,
        clientType,
        search,
        ...clientSearchLikeParams(searchQuery),
    ];

    const listInner = `
        SELECT
            c.id,
            c.client_code,
            c.client_type,
            c.membership_type,
            c.first_name,
            c.last_name,
            c.chinese_name,
            c.english_name,
            rpay.last_d AS last_payment,
            ryear.membership_y AS pay_y,
            c.status
        FROM clients c
        LEFT JOIN (
            SELECT payer_client_id, MAX(issue_date) AS last_d
            FROM receipts
            WHERE status = 'active'
            GROUP BY payer_client_id
        ) rpay ON rpay.payer_client_id = c.id
        LEFT JOIN (
            SELECT payer_client_id, MAX(membership_year) AS membership_y
            FROM receipts
            WHERE status = 'active'
              AND payment_type = 'Membership Fee'
            GROUP BY payer_client_id
        ) ryear ON ryear.payer_client_id = c.id
        ${filterSql}
    `;

    const mstatWhere = `WHERE (
  (t.status = 'disabled' AND ? = 1)
  OR (
    t.status != 'disabled'
    AND (
      ( ? = 1 AND t.membership_type = 'Lifetime' )
      OR (
        t.membership_type = 'General'
        AND (
          ( ? = 1 AND t.pay_y IS NOT NULL AND t.pay_y >= ? )
          OR ( ? = 1 AND t.pay_y = ? )
          OR ( ? = 1 AND (t.pay_y IS NULL OR t.pay_y < ?) )
        )
      )
    )
  )
)`;
    const mstatBinds: (string | number)[] = [id, il, ia, currentYear, iw, prevYear, ie, prevYear];
    const normalizedClientType = "LOWER(TRIM(t.client_type))";
    const normalizedMembershipType = "LOWER(TRIM(t.membership_type))";
    const displayNameSortExpression = "COALESCE(NULLIF(TRIM(t.chinese_name), ''), NULLIF(TRIM(t.english_name), ''), NULLIF(TRIM(t.first_name || ' ' || COALESCE(t.last_name, '')), ''), t.client_code) COLLATE NOCASE";
    const membershipStatusSortRank = `
            CASE
                WHEN LOWER(TRIM(t.status)) = 'disabled' THEN 0
                WHEN ${normalizedClientType} != 'member' THEN 5
                WHEN ${normalizedMembershipType} = 'general' AND t.pay_y IS NOT NULL AND t.pay_y >= ${currentYear} THEN 1
                WHEN ${normalizedMembershipType} = 'lifetime' THEN 2
                WHEN ${normalizedMembershipType} = 'general' AND t.pay_y = ${prevYear} THEN 3
                WHEN ${normalizedMembershipType} = 'general' THEN 4
                ELSE 5
            END
    `;
    const sortExpressions: Record<NonNullable<ClientDirectorySort["sort"]>, string> = {
        client_code: "t.client_code",
        chinese_name: displayNameSortExpression,
        last_payment: "t.last_payment",
        membership_status: membershipStatusSortRank,
    };
    const orderBy = sort.sort
        ? `${sortExpressions[sort.sort]} ${sortDirection}, t.id DESC`
        : "t.id DESC";

    const countRow = await rawFirst<{ count: number }>(db, {
        reasonKey: "domain.complex-directory-and-search",
        sql: `SELECT COUNT(*) AS count FROM ( ${listInner} ) t ${mstatWhere}`,
        params: [...innerBinds, ...mstatBinds],
    });

    const rows = await rawAll<{
        id: number;
        client_code: string;
        client_type: string;
        membership_type: string;
        first_name: string | null;
        last_name: string | null;
        chinese_name: string | null;
        english_name: string | null;
        last_payment: string | null;
        pay_y: number | null;
        status: string;
    }>(db, {
        reasonKey: "domain.complex-directory-and-search",
        sql: `SELECT
            t.id,
            t.client_code,
            t.client_type,
            t.membership_type,
            t.first_name,
            t.last_name,
            t.chinese_name,
            t.english_name,
            t.last_payment,
            t.pay_y,
            t.status
        FROM ( ${listInner} ) t ${mstatWhere}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?`,
        params: [...innerBinds, ...mstatBinds, limit, offset],
    });

    return {
        rows: rows.map((row) => ({
            id: row.id,
            clientCode: row.client_code,
            clientType: row.client_type,
            membershipType: row.membership_type,
            displayName: memberDisplayName({
                code: row.client_code,
                chineseName: row.chinese_name,
                englishName: memberDisplayEnglishName({
                    englishName: row.english_name,
                    firstName: row.first_name,
                    lastName: row.last_name,
                }),
            }),
            chineseName: row.chinese_name ?? "",
            englishName: memberDisplayEnglishName({
                englishName: row.english_name,
                firstName: row.first_name,
                lastName: row.last_name,
            }),
            lastPayment: row.last_payment,
            lastMembershipYear: row.pay_y,
            status: row.status,
        })),
        total: Number(countRow?.count ?? 0),
    };
}

export async function getClientByCode(
    db: AppDb,
    clientCode: string,
): Promise<ClientRecord | null> {
    const [row] = await db
        .select({
            id: schema.clients.id,
            client_code: schema.clients.clientCode,
            client_type: schema.clients.clientType,
            membership_type: schema.clients.membershipType,
            registration_date: schema.clients.registrationDate,
            fsii_registration_date: schema.clients.fsiiRegistrationDate,
            first_name: schema.clients.firstName,
            last_name: schema.clients.lastName,
            legal_name_photo_id_verified: schema.clients.legalNamePhotoIdVerified,
            english_name: schema.clients.englishName,
            chinese_name: schema.clients.chineseName,
            gender: schema.clients.gender,
            fsii_gender_detail: schema.clients.fsiiGenderDetail,
            other_gender: schema.clients.otherGender,
            dob: schema.clients.dob,
            age_years: schema.clients.ageYears,
            age_updated_date: schema.clients.ageUpdatedDate,
            cob: schema.clients.cob,
            birth_province: schema.clients.birthProvince,
            birth_city: schema.clients.birthCity,
            residential_status: schema.clients.residentialStatus,
            is_volunteer: schema.clients.isVolunteer,
            address: schema.clients.address,
            community: schema.clients.community,
            postal_code: schema.clients.postalCode,
            tel: schema.clients.tel,
            email: schema.clients.email,
            wechat_id: schema.clients.wechatId,
            emergency_contact_person: schema.clients.emergencyContactPerson,
            emergency_contact_relationship: schema.clients.emergencyContactRelationship,
            emergency_contact_tel: schema.clients.emergencyContactTel,
            referrer_name: schema.clients.referrerName,
            director_name: schema.clients.directorName,
            approver_name: schema.clients.approverName,
            major_language: schema.clients.majorLanguage,
            population_group: schema.clients.populationGroup,
            marital_status: schema.clients.maritalStatus,
            housing_situation: schema.clients.housingSituation,
            primary_income: schema.clients.primaryIncome,
            grade_in_school: schema.clients.gradeInSchool,
            number_child: schema.clients.numberChild,
            number_adult: schema.clients.numberAdult,
            highest_grade: schema.clients.highestGrade,
            education_level: schema.clients.educationLevel,
            indigenous_identity: schema.clients.indigenousIdentity,
            arrival_month: schema.clients.arrivalMonth,
            physical_accessibility_difficulty: schema.clients.physicalAccessibilityDifficulty,
            cognitive_difficulty: schema.clients.cognitiveDifficulty,
            emotional_mental_health_condition: schema.clients.emotionalMentalHealthCondition,
            remark: schema.clients.remark,
            qr_code_key: schema.clients.qrCodeKey,
            status: schema.clients.status,
        })
        .from(schema.clients)
        .where(eq(schema.clients.clientCode, clientCode))
        .limit(1);

    if (!row) return null;

    return {
        id: row.id,
        clientCode: row.client_code,
        clientType: row.client_type,
        membershipType: row.membership_type,
        registrationDate: toSqlDate(row.registration_date) ?? nowSqlDate(),
        fsiiRegistrationDate: row.fsii_registration_date ?? "",
        firstName: row.first_name ?? "",
        lastName: row.last_name ?? "",
        legalNamePhotoIdVerified: row.legal_name_photo_id_verified === 1,
        englishName: row.english_name ?? "",
        chineseName: row.chinese_name ?? "",
        gender: restoreMemberGender(row.gender, row.fsii_gender_detail),
        otherGender: row.other_gender ?? "",
        dob: toSqlDate(row.dob) ?? "",
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
        tel: row.tel ?? "",
        email: row.email ?? "",
        wechatID: row.wechat_id ?? "",
        emergencyContactPerson: row.emergency_contact_person ?? "",
        emergencyContactRelationship: row.emergency_contact_relationship ?? "",
        emergencyContactTel: row.emergency_contact_tel ?? "",
        referrerName: row.referrer_name ?? "",
        directorName: row.director_name ?? "",
        approverName: row.approver_name ?? "",
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
        qrCodeKey: row.qr_code_key,
        status: row.status,
    };
}

function clientValuesFromInput(
    input: ClientFormInput,
    {
        includeRegistrationDate = true,
        previousAge = null,
        today = nowSqlDate(),
    }: {
        includeRegistrationDate?: boolean;
        previousAge?: DobAgePreviousState;
        today?: string;
    } = {},
): Partial<typeof schema.clients.$inferInsert> {
    const chineseNameSearchIndex = buildNullableChineseNameSearchIndex(input.chineseName);
    const values: Partial<typeof schema.clients.$inferInsert> = {
        clientType: input.clientType,
        membershipType: input.membershipType,
        firstName: input.firstName || null,
        lastName: input.lastName || null,
        legalNamePhotoIdVerified: input.legalNamePhotoIdVerified ? 1 : 0,
        englishName: null,
        chineseName: input.chineseName,
        chineseNamePinyin: chineseNameSearchIndex.pinyin,
        chineseNamePinyinCompact: chineseNameSearchIndex.pinyinCompact,
        chineseNamePinyinInitials: chineseNameSearchIndex.pinyinInitials,
        chineseNamePinyinGivenSurname: chineseNameSearchIndex.pinyinGivenSurname,
        chineseNameSearchTerms: chineseNameSearchIndex.searchTerms,
        ...memberGenderForStorage(input.gender),
        otherGender: input.gender === "Other" ? input.otherGender || null : null,
        // Age mode wins: a residual dob is written as NULL, and switching back
        // to dob mode clears both age columns.
        dob: input.dobAgeOnly ? null : toSqlDate(input.dob),
        ...resolveDobAgeWriteValues(input, previousAge, today),
        cob: input.cob || null,
        birthProvince: input.birthProvince || null,
        birthCity: input.birthCity || null,
        residentialStatus: residentialStatusForStorage(input.residentialStatus),
        isVolunteer: input.isVolunteer ? 1 : 0,
        address: input.address || null,
        community: input.community || null,
        postalCode: input.postalCode || null,
        tel: input.tel || null,
        email: input.email || null,
        wechatId: input.wechatID || null,
        emergencyContactPerson: input.emergencyContactPerson || null,
        emergencyContactRelationship: input.emergencyContactRelationship || null,
        emergencyContactTel: input.emergencyContactTel || null,
        referrerName: input.referrerName || null,
        directorName: input.directorName || null,
        approverName: input.approverName || null,
        majorLanguage: input.majorLanguage || null,
        populationGroup: input.populationGroup || null,
        maritalStatus: input.maritalStatus || null,
        housingSituation: input.housingSituation || null,
        primaryIncome: input.primaryIncome || null,
        gradeInSchool: input.gradeInSchool ? Number(input.gradeInSchool) : null,
        numberChild: input.numberChild,
        numberAdult: input.numberAdult,
        highestGrade: input.highestGrade || null,
        educationLevel: input.educationLevel || null,
        indigenousIdentity: input.indigenousIdentity || null,
        arrivalMonth: input.arrivalMonth || null,
        physicalAccessibilityDifficulty: input.physicalAccessibilityDifficulty || null,
        cognitiveDifficulty: input.cognitiveDifficulty || null,
        emotionalMentalHealthCondition: input.emotionalMentalHealthCondition || null,
        remark: input.remark || null,
    };
    if (includeRegistrationDate) {
        values.registrationDate = toSqlDate(input.registrationDate);
    }
    return values;
}

export async function createClient(
    db: AppDb,
    input: ClientFormInput,
    { allowMissingRequired = false }: { allowMissingRequired?: boolean } = {},
): Promise<string> {
    validateClientForSave(input, { allowMissingRequired });

    for (let attempt = 1; attempt <= GENERATED_CODE_MAX_ATTEMPTS; attempt += 1) {
        const clientCode = await generateNextClientCode(db);
        const timestamp = nowSqlDateTime();
        try {
            await db.insert(schema.clients).values({
                clientCode,
                ...clientValuesFromInput({
                    ...input,
                    registrationDate: nowSqlDate(),
                }),
                status: "active",
                createdAt: timestamp,
                updatedAt: timestamp,
            } as typeof schema.clients.$inferInsert);
            return clientCode;
        } catch (cause) {
            if (attempt < GENERATED_CODE_MAX_ATTEMPTS && isUniqueConstraintError(cause)) {
                continue;
            }
            throw cause;
        }
    }

    throw new Error("Failed to generate a unique client code");
}

export async function updateClient(
    db: AppDb,
    clientCode: string,
    input: ClientFormInput,
    {
        requireLegalName = true,
        allowMissingRequired = false,
    }: {
        requireLegalName?: boolean;
        allowMissingRequired?: boolean;
    } = {},
): Promise<void> {
    validateClientForSave(input, { requireLegalName, allowMissingRequired });

    const [previousAgeRow] = await db
        .select({
            ageYears: schema.clients.ageYears,
            ageUpdatedDate: schema.clients.ageUpdatedDate,
        })
        .from(schema.clients)
        .where(eq(schema.clients.clientCode, clientCode))
        .limit(1);

    const timestamp = nowSqlDateTime();
    await db
        .update(schema.clients)
        .set({
            ...clientValuesFromInput(input, {
                includeRegistrationDate: false,
                previousAge: previousAgeRow ?? null,
            }),
            updatedAt: timestamp,
        })
        .where(eq(schema.clients.clientCode, clientCode));
}

export async function listChildMembers(
    db: AppDb,
    options: {
        search?: string;
        page: number;
        limit: number;
        membershipStatus?: MembershipStatusFilter;
        sort?: ClientDirectorySort;
    },
): Promise<{ rows: ChildMemberListItem[]; total: number }> {
    const search = options.search?.trim() ?? "";
    const page = Math.max(options.page, 1);
    const limit = Math.max(options.limit, 1);
    const offset = (page - 1) * limit;
    const searchQuery = buildChineseNameSearchQuery(search);
    const sort = options.sort ?? { sort: null, dir: "desc" };
    const sortDirection = sort.dir === "asc" ? "ASC" : "DESC";

    const filterSql = `
        WHERE (
            ? = ''
            OR ${childMemberSearchLikeCondition("cm", searchQuery)}
        )
    `;

    const mstat = options.membershipStatus ?? DEFAULT_MEMBERSHIP_STATUS_FILTER;
    // Disabled is an independent state and is excluded by default.
    const currentYear = Number(nowSqlDate().slice(0, 4));
    const prevYear = currentYear - 1;
    const il = mstat.includeLifetime ? 1 : 0;
    const ia = mstat.includeActive ? 1 : 0;
    const iw = mstat.includeWarning ? 1 : 0;
    const ie = mstat.includeExpired ? 1 : 0;
    const id = mstat.includeDisabled ? 1 : 0;
    const innerBinds: (string | number)[] = [
        search,
        ...childMemberSearchLikeParams(searchQuery),
    ];

    const listInner = `
        SELECT
            cm.id,
            cm.child_code,
            cm.membership_type,
            cm.chinese_name,
            cm.english_name,
            rpay.last_d AS last_payment,
            ryear.membership_y AS pay_y,
            cm.status
        FROM child_members cm
        LEFT JOIN (
            SELECT payer_child_member_id, MAX(issue_date) AS last_d
            FROM receipts
            WHERE status = 'active'
            GROUP BY payer_child_member_id
        ) rpay ON rpay.payer_child_member_id = cm.id
        LEFT JOIN (
            SELECT payer_child_member_id, MAX(membership_year) AS membership_y
            FROM receipts
            WHERE status = 'active'
              AND payment_type = 'Membership Fee'
            GROUP BY payer_child_member_id
        ) ryear ON ryear.payer_child_member_id = cm.id
        ${filterSql}
    `;

    const mstatWhere = `WHERE (
  (t.status = 'disabled' AND ? = 1)
  OR (
    t.status != 'disabled'
    AND (
      ( ? = 1 AND t.membership_type = 'Lifetime' )
      OR (
        t.membership_type = 'General'
        AND (
          ( ? = 1 AND t.pay_y IS NOT NULL AND t.pay_y >= ? )
          OR ( ? = 1 AND t.pay_y = ? )
          OR ( ? = 1 AND (t.pay_y IS NULL OR t.pay_y < ?) )
        )
      )
    )
  )
)`;
    const mstatBinds: (string | number)[] = [id, il, ia, currentYear, iw, prevYear, ie, prevYear];
    const normalizedMembershipType = "LOWER(TRIM(t.membership_type))";
    const membershipStatusSortRank = `
            CASE
                WHEN LOWER(TRIM(t.status)) = 'disabled' THEN 0
                WHEN ${normalizedMembershipType} = 'general' AND t.pay_y IS NOT NULL AND t.pay_y >= ${currentYear} THEN 1
                WHEN ${normalizedMembershipType} = 'lifetime' THEN 2
                WHEN ${normalizedMembershipType} = 'general' AND t.pay_y = ${prevYear} THEN 3
                WHEN ${normalizedMembershipType} = 'general' THEN 4
                ELSE 5
            END
        `;
    const sortExpressions: Record<NonNullable<ClientDirectorySort["sort"]>, string> = {
        client_code: "t.child_code",
        chinese_name: "t.chinese_name COLLATE NOCASE",
        last_payment: "t.last_payment",
        membership_status: membershipStatusSortRank,
    };
    const orderBy = sort.sort
        ? `${sortExpressions[sort.sort]} ${sortDirection}, t.id DESC`
        : "t.id DESC";

    const countRow = await rawFirst<{ count: number }>(db, {
        reasonKey: "domain.complex-directory-and-search",
        sql: `SELECT COUNT(*) AS count FROM ( ${listInner} ) t ${mstatWhere}`,
        params: [...innerBinds, ...mstatBinds],
    });

    const rows = await rawAll<{
        id: number;
        child_code: string;
        membership_type: string;
        chinese_name: string;
        english_name: string | null;
        last_payment: string | null;
        pay_y: number | null;
        status: string;
    }>(db, {
        reasonKey: "domain.complex-directory-and-search",
        sql: `SELECT
            t.id,
            t.child_code,
            t.membership_type,
            t.chinese_name,
            t.english_name,
            t.last_payment,
            t.pay_y,
            t.status
        FROM ( ${listInner} ) t ${mstatWhere} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
        params: [...innerBinds, ...mstatBinds, limit, offset],
    });

    return {
        rows: rows.map((row) => ({
            id: row.id,
            childCode: row.child_code,
            membershipType: row.membership_type,
            chineseName: row.chinese_name,
            englishName: row.english_name,
            lastPayment: row.last_payment,
            lastMembershipYear: row.pay_y,
            status: row.status,
        })),
        total: Number(countRow?.count ?? 0),
    };
}

export async function getChildMemberByCode(
    db: AppDb,
    childCode: string,
): Promise<ChildMemberRecord | null> {
    const [row] = await db
        .select({
            id: schema.childMembers.id,
            child_code: schema.childMembers.childCode,
            membership_type: schema.childMembers.membershipType,
            membership_expiry_date: schema.childMembers.membershipExpiryDate,
            registration_date: schema.childMembers.registrationDate,
            first_name: schema.childMembers.firstName,
            last_name: schema.childMembers.lastName,
            english_name: schema.childMembers.englishName,
            chinese_name: schema.childMembers.chineseName,
            gender: schema.childMembers.gender,
            dob: schema.childMembers.dob,
            cob: schema.childMembers.cob,
            residential_status: schema.childMembers.residentialStatus,
            year_of_arrival: schema.childMembers.yearOfArrival,
            community: schema.childMembers.community,
            postal_code: schema.childMembers.postalCode,
            tel: schema.childMembers.tel,
            email: schema.childMembers.email,
            wechat_id: schema.childMembers.wechatId,
            emergency_contact_person: schema.childMembers.emergencyContactPerson,
            emergency_contact_tel: schema.childMembers.emergencyContactTel,
            parent_type: schema.childMembers.parentType,
            parent_client_id: schema.childMembers.parentClientId,
            parent_client_code: schema.clients.clientCode,
            parent_client_chinese_name: schema.clients.chineseName,
            parent_client_english_name: schema.clients.englishName,
            parent_client_status:
                sql<"active" | "disabled" | null>`${schema.clients.status}`.as(
                    "parent_client_status",
                ),
            parent_temporary_participant_id:
                schema.childMembers.parentTemporaryParticipantId,
            parent_temporary_participant_code:
                sql<string | null>`CASE WHEN ${schema.temporaryParticipants.id} IS NULL THEN NULL ELSE 'TMP' || printf('%04d', ${schema.temporaryParticipants.id}) END`,
            parent_temporary_participant_legal_name:
                sql<string | null>`trim(${schema.temporaryParticipants.firstName}) || ' ' || trim(${schema.temporaryParticipants.lastName})`,
            parent_temporary_participant_status:
                sql<"active" | "disabled" | null>`${schema.temporaryParticipants.status}`.as(
                    "parent_temporary_participant_status",
                ),
            parent_name: schema.childMembers.parentName,
            parent_contact: schema.childMembers.parentContact,
            major_language: schema.childMembers.majorLanguage,
            population_group: schema.childMembers.populationGroup,
            marital_status: schema.childMembers.maritalStatus,
            housing_situation: schema.childMembers.housingSituation,
            primary_income: schema.childMembers.primaryIncome,
            number_child: schema.childMembers.numberChild,
            number_adult: schema.childMembers.numberAdult,
            highest_grade: schema.childMembers.highestGrade,
            education_level: schema.childMembers.educationLevel,
            accessibility_q1: schema.childMembers.accessibilityQ1,
            accessibility_q2: schema.childMembers.accessibilityQ2,
            accessibility_q3: schema.childMembers.accessibilityQ3,
            remark: schema.childMembers.remark,
            status: schema.childMembers.status,
        })
        .from(schema.childMembers)
        .leftJoin(schema.clients, eq(schema.clients.id, schema.childMembers.parentClientId))
        .leftJoin(
            schema.temporaryParticipants,
            eq(
                schema.temporaryParticipants.id,
                schema.childMembers.parentTemporaryParticipantId,
            ),
        )
        .where(eq(schema.childMembers.childCode, childCode))
        .limit(1);

    if (!row) return null;

    return {
        id: row.id,
        childCode: row.child_code,
        membershipType: row.membership_type,
        membershipExpiryDate: toSqlDate(row.membership_expiry_date) ?? "",
        registrationDate: toSqlDate(row.registration_date) ?? nowSqlDate(),
        firstName: row.first_name ?? "",
        lastName: row.last_name ?? "",
        englishName: row.english_name ?? "",
        chineseName: row.chinese_name,
        gender: row.gender ?? "",
        dob: toSqlDate(row.dob) ?? "",
        cob: row.cob ?? "",
        residentialStatus: row.residential_status ?? "",
        yearOfArrival: row.year_of_arrival,
        community: row.community ?? "",
        postalCode: row.postal_code ?? "",
        tel: row.tel ?? "",
        email: row.email ?? "",
        wechatID: row.wechat_id ?? "",
        emergencyContactPerson: row.emergency_contact_person ?? "",
        emergencyContactTel: row.emergency_contact_tel ?? "",
        parentType: row.parent_client_id !== null
            ? "member"
            : row.parent_temporary_participant_id !== null
              ? "temporary"
              : "legacy",
        parentClientId: row.parent_client_id,
        parentClientCode: row.parent_client_code ?? "",
        parentClientChineseName: row.parent_client_chinese_name ?? "",
        parentClientEnglishName: row.parent_client_english_name ?? "",
        parentClientStatus: row.parent_client_status ?? "",
        parentTemporaryParticipantId: row.parent_temporary_participant_id,
        parentTemporaryParticipantCode: row.parent_temporary_participant_code ?? "",
        parentTemporaryParticipantLegalName:
            row.parent_temporary_participant_legal_name ?? "",
        parentTemporaryParticipantStatus:
            row.parent_temporary_participant_status ?? "",
        parentName: row.parent_name ?? "",
        parentContact: row.parent_contact ?? "",
        parentInlineFirstName: "",
        parentInlineLastName: "",
        parentInlineGender: "",
        parentInlineDob: "",
        parentInlineTel: "",
        parentInlineEmail: "",
        majorLanguage: row.major_language ?? "",
        populationGroup: row.population_group ?? "",
        maritalStatus: row.marital_status ?? "",
        housingSituation: row.housing_situation ?? "",
        primaryIncome: row.primary_income ?? "",
        numberChild: row.number_child,
        numberAdult: row.number_adult,
        highestGrade: row.highest_grade ?? "",
        educationLevel: row.education_level ?? "",
        accessibilityQ1: row.accessibility_q1 ?? "",
        accessibilityQ2: row.accessibility_q2 ?? "",
        accessibilityQ3: row.accessibility_q3 ?? "",
        remark: row.remark ?? "",
        status: row.status,
    };
}

type ResolvedChildMemberParent =
    | { kind: "member"; id: number }
    | { kind: "temporary"; id: number }
    | {
        kind: "inline_create";
        input: TemporaryParticipantInput;
        normalizedName: string;
    };

type ChildMemberSqlValue = string | number | null;

function childMemberColumnValues(
    input: ChildMemberFormInput,
    parent: ResolvedChildMemberParent,
    options: {
        includeRegistrationDate: boolean;
        includeLegacyFields: boolean;
    },
): Array<[column: string, value: ChildMemberSqlValue]> {
    const chineseNameSearchIndex = buildChineseNameSearchIndex(input.chineseName);
    const values: Array<[string, ChildMemberSqlValue]> = [
        ["membership_type", input.membershipType],
        ["membership_expiry_date", toSqlDate(input.membershipExpiryDate)],
        ["first_name", input.firstName || null],
        ["last_name", input.lastName || null],
        ["english_name", input.englishName || null],
        ["chinese_name", input.chineseName],
        ["chinese_name_pinyin", chineseNameSearchIndex.pinyin],
        ["chinese_name_pinyin_compact", chineseNameSearchIndex.pinyinCompact],
        ["chinese_name_pinyin_initials", chineseNameSearchIndex.pinyinInitials],
        ["chinese_name_pinyin_given_surname", chineseNameSearchIndex.pinyinGivenSurname],
        ["chinese_name_search_terms", chineseNameSearchIndex.searchTerms],
        ["gender", genderForStorage(input.gender)],
        ["dob", toSqlDate(input.dob)],
        ["cob", input.cob || null],
        ["residential_status", input.residentialStatus || null],
        ["year_of_arrival", input.yearOfArrival],
        ["parent_type", parent.kind === "member" ? "member" : "non_member"],
        ["parent_client_id", parent.kind === "member" ? parent.id : null],
        [
            "parent_temporary_participant_id",
            parent.kind === "temporary" ? parent.id : null,
        ],
        ["parent_name", null],
        ["parent_contact", null],
        ["remark", input.remark || null],
    ];
    if (options.includeLegacyFields) {
        values.push(
            ["community", input.community || null],
            ["postal_code", input.postalCode || null],
            ["tel", input.tel || null],
            ["email", input.email || null],
            ["wechat_id", input.wechatID || null],
            ["emergency_contact_person", input.emergencyContactPerson || null],
            ["emergency_contact_tel", input.emergencyContactTel || null],
            ["major_language", input.majorLanguage || null],
            ["population_group", input.populationGroup || null],
            ["marital_status", input.maritalStatus || null],
            ["housing_situation", input.housingSituation || null],
            ["primary_income", input.primaryIncome || null],
            ["number_child", input.numberChild],
            ["number_adult", input.numberAdult],
            ["highest_grade", input.highestGrade || null],
            ["education_level", input.educationLevel || null],
            ["accessibility_q1", input.accessibilityQ1 || null],
            ["accessibility_q2", input.accessibilityQ2 || null],
            ["accessibility_q3", input.accessibilityQ3 || null],
        );
    }
    if (options.includeRegistrationDate) {
        values.push(["registration_date", toSqlDate(input.registrationDate)]);
    }
    return values;
}

function inlineTemporaryParentInput(input: ChildMemberFormInput): TemporaryParticipantInput {
    return {
        firstName: input.parentInlineFirstName,
        lastName: input.parentInlineLastName,
        gender: input.parentInlineGender as TemporaryParticipantInput["gender"],
        dob: input.parentInlineDob,
        tel: input.parentInlineTel,
        email: input.parentInlineEmail,
    };
}

async function isChildMemberParentActive(
    db: AppDb,
    parent: Exclude<ResolvedChildMemberParent, { kind: "inline_create" }>,
): Promise<boolean> {
    if (parent.kind === "member") {
        const [row] = await db.select({ id: schema.clients.id })
            .from(schema.clients)
            .where(and(
                eq(schema.clients.id, parent.id),
                eq(schema.clients.clientType, "Member"),
                eq(schema.clients.status, "active"),
            ))
            .limit(1);
        return Boolean(row);
    }
    const [row] = await db.select({ id: schema.temporaryParticipants.id })
        .from(schema.temporaryParticipants)
        .where(and(
            eq(schema.temporaryParticipants.id, parent.id),
            eq(schema.temporaryParticipants.status, "active"),
        ))
        .limit(1);
    return Boolean(row);
}

async function resolveChildMemberParent(
    db: AppDb,
    input: ChildMemberFormInput,
): Promise<ResolvedChildMemberParent> {
    if (input.parentType === "member") {
        if (!input.parentClientId) {
            throw new DomainValidationError(m.childMemberParentMemberRequired());
        }
        const parent = { kind: "member", id: input.parentClientId } as const;
        if (!await isChildMemberParentActive(db, parent)) {
            throw new DomainValidationError(m.childMemberParentMemberInvalid());
        }
        return parent;
    }
    if (input.parentType === "temporary") {
        if (!input.parentTemporaryParticipantId) {
            throw new DomainValidationError(m.childMemberParentTemporaryRequired());
        }
        const parent = {
            kind: "temporary",
            id: input.parentTemporaryParticipantId,
        } as const;
        if (!await isChildMemberParentActive(db, parent)) {
            throw new DomainValidationError(m.childMemberParentTemporaryInvalid());
        }
        return parent;
    }
    if (input.parentType !== "inline") {
        throw new DomainValidationError(m.childMemberParentResolutionRequired());
    }

    const inlineInput = inlineTemporaryParentInput(input);
    if (validateTemporaryParticipantInput(inlineInput)) {
        throw new DomainValidationError(m.childMemberParentInlineInvalid());
    }
    const exact = await findTemporaryParticipantDuplicate(
        db,
        inlineInput.firstName,
        inlineInput.lastName,
        inlineInput.dob,
    );
    if (exact) {
        if (exact.status !== "active") {
            throw new DomainValidationError(
                m.childMemberParentTemporaryDisabled({ code: exact.participantCode }),
            );
        }
        return { kind: "temporary", id: exact.id };
    }

    return {
        kind: "inline_create",
        input: inlineInput,
        normalizedName: normalizeTemporaryParticipantStructuredName(
            inlineInput.firstName,
            inlineInput.lastName,
        ),
    };
}

function childParentEligibilitySql(parent: ResolvedChildMemberParent): {
    sql: string;
    params: ChildMemberSqlValue[];
} {
    if (parent.kind === "member") {
        return {
            sql: "EXISTS (SELECT 1 FROM clients AS parent WHERE parent.id = ? AND parent.client_type = 'Member' AND parent.status = 'active')",
            params: [parent.id],
        };
    }
    if (parent.kind === "temporary") {
        return {
            sql: "EXISTS (SELECT 1 FROM temporary_participants AS parent WHERE parent.id = ? AND parent.status = 'active')",
            params: [parent.id],
        };
    }
    return {
        sql: `EXISTS (SELECT 1 FROM temporary_participants AS parent WHERE ${sqliteNormalizedFirstLastNameExpression("parent.first_name", "parent.last_name")} = ? AND parent.dob = ? AND parent.status = 'active')`,
        params: [parent.normalizedName, parent.input.dob.trim()],
    };
}

function childMemberWriteStatement(input: {
    childCode: string;
    values: Array<[string, ChildMemberSqlValue]>;
    parent: ResolvedChildMemberParent;
    timestamp: string;
    operation: "insert" | "update";
}) {
    const eligibility = childParentEligibilitySql(input.parent);
    const values = input.values.map(([column, value]) => ({ column, value }));
    const temporaryParentIndex = values.findIndex(
        ({ column }) => column === "parent_temporary_participant_id",
    );
    const valueSql = values.map(({ column }) =>
        column === "parent_temporary_participant_id" && input.parent.kind === "inline_create"
            ? `(SELECT parent.id FROM temporary_participants AS parent WHERE ${sqliteNormalizedFirstLastNameExpression("parent.first_name", "parent.last_name")} = ? AND parent.dob = ? AND parent.status = 'active')`
            : "?"
    );
    const valueParams = values.flatMap(({ value }, index) =>
        index === temporaryParentIndex && input.parent.kind === "inline_create"
            ? [input.parent.normalizedName, input.parent.input.dob.trim()]
            : [value]
    );

    if (input.operation === "insert") {
        const columns = ["child_code", ...values.map(({ column }) => column), "status", "created_at", "updated_at"];
        return {
            sql: `INSERT INTO child_members (${columns.join(", ")})
                SELECT ?, ${valueSql.join(", ")}, 'active', ?, ?
                WHERE ${eligibility.sql}`,
            params: [input.childCode, ...valueParams, input.timestamp, input.timestamp, ...eligibility.params],
        };
    }

    return {
        sql: `UPDATE child_members
            SET ${values.map(({ column }, index) => `${column} = ${valueSql[index]}`).join(", ")}, updated_at = ?
            WHERE child_code = ? AND ${eligibility.sql}`,
        params: [...valueParams, input.timestamp, input.childCode, ...eligibility.params],
    };
}

const CHILD_MEMBER_WRITE_GUARD = {
    sql: `INSERT INTO child_members (child_code, chinese_name, created_at, updated_at)
        SELECT NULL, NULL, NULL, NULL WHERE changes() = 0`,
};

function inlineTemporaryParentInsertStatement(
    parent: Extract<ResolvedChildMemberParent, { kind: "inline_create" }>,
    timestamp: string,
) {
    return {
        sql: `INSERT INTO temporary_participants (
            first_name, last_name, gender, dob, tel, email, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        params: [
            cleanTemporaryParticipantLegalName(parent.input.firstName),
            cleanTemporaryParticipantLegalName(parent.input.lastName),
            parent.input.gender,
            parent.input.dob.trim(),
            parent.input.tel.trim(),
            parent.input.email.trim(),
            timestamp,
            timestamp,
        ],
    };
}

async function saveChildMemberWithParent(
    db: AppDb,
    input: ChildMemberFormInput,
    childCode: string,
    parent: ResolvedChildMemberParent,
    operation: "insert" | "update",
): Promise<void> {
    const timestamp = nowSqlDateTime();
    const values = childMemberColumnValues(input, parent, {
        includeRegistrationDate: operation === "insert",
        includeLegacyFields: operation === "insert",
    });
    const write = childMemberWriteStatement({ childCode, values, parent, timestamp, operation });
    await rawBatch(db, {
        reasonKey: "child-member.atomic-parent-save",
        statements: [
            ...(parent.kind === "inline_create"
                ? [inlineTemporaryParentInsertStatement(parent, timestamp)]
                : []),
            write,
            CHILD_MEMBER_WRITE_GUARD,
        ],
    });
}

export async function createChildMember(
    db: AppDb,
    input: ChildMemberFormInput,
): Promise<string> {
    if (!isValidCanadianPostalCode(input.postalCode)) {
        throw new DomainValidationError(m.postalCodeInvalid());
    }
    if (!isValidEmail(input.email)) {
        throw new DomainValidationError(m.emailInvalid());
    }
    let parent = await resolveChildMemberParent(db, input);
    for (let attempt = 1; attempt <= GENERATED_CODE_MAX_ATTEMPTS; attempt += 1) {
        const childCode = await generateNextChildMemberCode(db);
        try {
            await saveChildMemberWithParent(
                db,
                { ...input, registrationDate: nowSqlDate() },
                childCode,
                parent,
                "insert",
            );
            return childCode;
        } catch (cause) {
            if (attempt < GENERATED_CODE_MAX_ATTEMPTS && isUniqueConstraintError(cause)) {
                if (parent.kind === "inline_create") {
                    parent = await resolveChildMemberParent(db, input);
                    if (parent.kind !== "inline_create") continue;
                }
                continue;
            }
            if (parent.kind !== "inline_create" && !await isChildMemberParentActive(db, parent)) {
                throw new DomainValidationError(
                    parent.kind === "member"
                        ? m.childMemberParentMemberInvalid()
                        : m.childMemberParentTemporaryInvalid(),
                );
            }
            throw cause;
        }
    }

    throw new Error("Failed to generate a unique child member code");
}

export async function updateChildMember(
    db: AppDb,
    childCode: string,
    input: ChildMemberFormInput,
): Promise<void> {
    if (!isValidCanadianPostalCode(input.postalCode)) {
        throw new DomainValidationError(m.postalCodeInvalid());
    }
    if (!isValidEmail(input.email)) {
        throw new DomainValidationError(m.emailInvalid());
    }
    let parent = await resolveChildMemberParent(db, input);
    try {
        await saveChildMemberWithParent(db, input, childCode, parent, "update");
    } catch (cause) {
        if (parent.kind === "inline_create" && isUniqueConstraintError(cause)) {
            parent = await resolveChildMemberParent(db, input);
            if (parent.kind !== "inline_create") {
                await saveChildMemberWithParent(db, input, childCode, parent, "update");
                return;
            }
        }
        if (parent.kind !== "inline_create" && !await isChildMemberParentActive(db, parent)) {
            throw new DomainValidationError(
                parent.kind === "member"
                    ? m.childMemberParentMemberInvalid()
                    : m.childMemberParentTemporaryInvalid(),
            );
        }
        throw cause;
    }
}

function organizationValuesFromInput(
    input: OrganizationFormInput,
): Partial<typeof schema.organizations.$inferInsert> {
    const chineseNameSearchIndex = buildChineseNameSearchIndex(input.chineseName);

    return {
        registrationDate: toSqlDate(input.registrationDate),
        englishName: input.englishName,
        chineseName: input.chineseName,
        chineseNamePinyin: chineseNameSearchIndex.pinyin,
        chineseNamePinyinCompact: chineseNameSearchIndex.pinyinCompact,
        chineseNamePinyinInitials: chineseNameSearchIndex.pinyinInitials,
        chineseNamePinyinGivenSurname: chineseNameSearchIndex.pinyinGivenSurname,
        chineseNameSearchTerms: chineseNameSearchIndex.searchTerms,
        community: input.community || null,
        postalCode: input.postalCode || null,
        tel: input.tel || null,
        email: input.email || null,
        wechatId: input.wechatID || null,
        website: input.website || null,
        remark: input.remark || null,
    };
}

async function replaceOrganizationContacts(
    db: AppDb,
    organizationId: number,
    contacts: OrganizationContactInput[],
): Promise<void> {
    await db
        .delete(schema.organizationContacts)
        .where(eq(schema.organizationContacts.organizationId, organizationId));

    const timestamp = nowSqlDateTime();
    const values = contacts.map((contact, index) => {
        const chineseNameSearchIndex = buildChineseNameSearchIndex(contact.chineseName);
        return {
            organizationId,
            chineseName: contact.chineseName,
            chineseNameSearchTerms: chineseNameSearchIndex.searchTerms,
            englishName: contact.englishName,
            tel: contact.tel || null,
            email: contact.email || null,
            wechatId: contact.wechatID || null,
            sortOrder: index,
            createdAt: timestamp,
            updatedAt: timestamp,
        };
    });
    if (values.length > 0) {
        await db.insert(schema.organizationContacts).values(values);
    }
}

function mapOrganizationContactRow(row: {
    id: number;
    chinese_name: string;
    english_name: string;
    tel: string | null;
    email: string | null;
    wechat_id: string | null;
}): OrganizationContactRecord {
    return {
        id: row.id,
        chineseName: row.chinese_name,
        englishName: row.english_name,
        tel: row.tel ?? "",
        email: row.email ?? "",
        wechatID: row.wechat_id ?? "",
    };
}

async function listOrganizationContacts(
    db: AppDb,
    organizationId: number,
): Promise<OrganizationContactRecord[]> {
    const rows = await db
        .select({
            id: schema.organizationContacts.id,
            chinese_name: schema.organizationContacts.chineseName,
            english_name: schema.organizationContacts.englishName,
            tel: schema.organizationContacts.tel,
            email: schema.organizationContacts.email,
            wechat_id: schema.organizationContacts.wechatId,
        })
        .from(schema.organizationContacts)
        .where(eq(schema.organizationContacts.organizationId, organizationId))
        .orderBy(
            asc(schema.organizationContacts.sortOrder),
            asc(schema.organizationContacts.id),
        );

    return rows.map(mapOrganizationContactRow);
}

export async function listOrganizations(
    db: AppDb,
    options: {
        search?: string;
        page: number;
        limit: number;
    },
): Promise<{ rows: OrganizationListItem[]; total: number }> {
    const search = options.search?.trim() ?? "";
    const page = Math.max(options.page, 1);
    const limit = Math.max(options.limit, 1);
    const offset = (page - 1) * limit;
    const searchQuery = buildChineseNameSearchQuery(search);
    const binds = [
        search,
        ...organizationSearchLikeParams(searchQuery),
        ...organizationContactSearchLikeParams(searchQuery),
    ];
    const filterSql = `
        WHERE (
            ? = ''
            OR ${organizationSearchLikeCondition("o", searchQuery)}
            OR EXISTS (
                SELECT 1
                FROM organization_contacts oc_search
                WHERE oc_search.organization_id = o.id
                  AND (
                    ${organizationContactSearchLikeCondition("oc_search", searchQuery)}
                  )
            )
        )
    `;
    const countRow = await rawFirst<{ count: number }>(db, {
        reasonKey: "domain.complex-directory-and-search",
        sql: `SELECT COUNT(*) AS count FROM organizations o ${filterSql}`,
        params: binds,
    });
    const rows = await rawAll<{
        id: number;
        organization_code: string;
        chinese_name: string;
        english_name: string;
        primary_contact: string | null;
        contact_count: number;
        last_payment: string | null;
        status: string;
    }>(db, {
        reasonKey: "domain.complex-directory-and-search",
        sql: `
        SELECT
            o.id,
            o.organization_code,
            o.chinese_name,
            o.english_name,
            (
                SELECT oc.chinese_name || ' / ' || oc.english_name
                FROM organization_contacts oc
                WHERE oc.organization_id = o.id
                ORDER BY oc.sort_order ASC, oc.id ASC
                LIMIT 1
            ) AS primary_contact,
            (
                SELECT COUNT(*)
                FROM organization_contacts oc
                WHERE oc.organization_id = o.id
            ) AS contact_count,
            rpay.last_d AS last_payment,
            o.status
        FROM organizations o
        LEFT JOIN (
            SELECT payer_organization_id, MAX(issue_date) AS last_d
            FROM receipts
            WHERE status = 'active'
            GROUP BY payer_organization_id
        ) rpay ON rpay.payer_organization_id = o.id
        ${filterSql}
        ORDER BY o.id DESC
        LIMIT ? OFFSET ?
        `,
        params: [...binds, limit, offset],
    });

    return {
        rows: rows.map((row) => ({
            id: row.id,
            organizationCode: row.organization_code,
            chineseName: row.chinese_name,
            englishName: row.english_name,
            primaryContact: row.primary_contact,
            contactCount: Number(row.contact_count ?? 0),
            lastPayment: row.last_payment,
            status: row.status,
        })),
        total: Number(countRow?.count ?? 0),
    };
}

export async function getOrganizationByCode(
    db: AppDb,
    organizationCode: string,
): Promise<OrganizationRecord | null> {
    const [row] = await db
        .select({
            id: schema.organizations.id,
            organization_code: schema.organizations.organizationCode,
            registration_date: schema.organizations.registrationDate,
            english_name: schema.organizations.englishName,
            chinese_name: schema.organizations.chineseName,
            community: schema.organizations.community,
            postal_code: schema.organizations.postalCode,
            tel: schema.organizations.tel,
            email: schema.organizations.email,
            wechat_id: schema.organizations.wechatId,
            website: schema.organizations.website,
            remark: schema.organizations.remark,
            status: schema.organizations.status,
        })
        .from(schema.organizations)
        .where(eq(schema.organizations.organizationCode, organizationCode))
        .limit(1);

    if (!row) return null;

    return {
        id: row.id,
        organizationCode: row.organization_code,
        registrationDate: toSqlDate(row.registration_date) ?? nowSqlDate(),
        englishName: row.english_name,
        chineseName: row.chinese_name,
        community: row.community ?? "",
        postalCode: row.postal_code ?? "",
        tel: row.tel ?? "",
        email: row.email ?? "",
        wechatID: row.wechat_id ?? "",
        website: row.website ?? "",
        remark: row.remark ?? "",
        status: row.status,
        contacts: await listOrganizationContacts(db, row.id),
    };
}

export async function createOrganization(
    db: AppDb,
    input: OrganizationFormInput,
): Promise<string> {
    for (let attempt = 1; attempt <= GENERATED_CODE_MAX_ATTEMPTS; attempt += 1) {
        const organizationCode = await generateNextOrganizationCode(db);
        const timestamp = nowSqlDateTime();
        try {
            const result = await db.insert(schema.organizations).values({
                organizationCode,
                ...organizationValuesFromInput(input),
                status: "active",
                createdAt: timestamp,
                updatedAt: timestamp,
            } as typeof schema.organizations.$inferInsert);
            await replaceOrganizationContacts(db, getLastInsertId(result), input.contacts);

            return organizationCode;
        } catch (cause) {
            if (attempt < GENERATED_CODE_MAX_ATTEMPTS && isUniqueConstraintError(cause)) {
                continue;
            }
            throw cause;
        }
    }

    throw new Error("Failed to generate a unique organization code");
}

export async function updateOrganization(
    db: AppDb,
    organizationCode: string,
    input: OrganizationFormInput,
): Promise<void> {
    const [existing] = await db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .where(eq(schema.organizations.organizationCode, organizationCode))
        .limit(1);
    if (!existing) return;

    const timestamp = nowSqlDateTime();
    await db
        .update(schema.organizations)
        .set({
            ...organizationValuesFromInput(input),
            updatedAt: timestamp,
        })
        .where(eq(schema.organizations.organizationCode, organizationCode));
    await replaceOrganizationContacts(db, existing.id, input.contacts);
}

export async function listActivePayers(
    db: AppDb,
    search = "",
): Promise<
    Array<{
        id: number;
        payerType: "client" | "child_member" | "organization";
        payerKey: string;
        code: string;
        label: string;
        clientType: string;
    }>
> {
    const searchText = search.trim();
    const searchQuery = buildChineseNameSearchQuery(searchText);
    const rows = await rawAll<{
        id: number;
        code: string;
        first_name: string | null;
        last_name: string | null;
        chinese_name: string | null;
        english_name: string | null;
        client_type: string;
        payer_type: "client" | "child_member" | "organization";
    }>(db, {
        reasonKey: "domain.complex-directory-and-search",
        sql: `
        SELECT *
        FROM (
            SELECT
                id,
                client_code AS code,
                first_name,
                last_name,
                chinese_name,
                english_name,
                client_type,
                'client' AS payer_type
            FROM clients
            WHERE status = 'active'
              AND client_type = 'Member'
              AND (
                ? = ''
                OR ${clientSearchLikeCondition("", searchQuery)}
              )

            UNION ALL

            SELECT
                id,
                child_code AS code,
                first_name,
                last_name,
                chinese_name,
                english_name,
                'Child Member' AS client_type,
                'child_member' AS payer_type
            FROM child_members
            WHERE status = 'active'
              AND (
                ? = ''
                OR ${childMemberSearchLikeCondition("", searchQuery)}
              )

            UNION ALL

            SELECT
                id,
                organization_code AS code,
                NULL AS first_name,
                NULL AS last_name,
                chinese_name,
                english_name,
                'Organization' AS client_type,
                'organization' AS payer_type
            FROM organizations
            WHERE status = 'active'
              AND (
                ? = ''
                OR ${organizationSearchLikeCondition("", searchQuery)}
              )
        )
        ORDER BY chinese_name ASC, code ASC
        LIMIT 50
        `,
        params: [
            searchText,
            ...clientSearchLikeParams(searchQuery),
            searchText,
            ...childMemberSearchLikeParams(searchQuery),
            searchText,
            ...organizationSearchLikeParams(searchQuery),
        ],
    });

    return rows.map((row) => ({
        id: row.id,
        payerType: row.payer_type,
        payerKey: `${row.payer_type}:${row.id}`,
        code: row.code,
        label: formatPayerLabel({
            code: row.code,
            chineseName: row.chinese_name,
            englishName: row.payer_type === "client"
                ? memberDisplayEnglishName({
                    englishName: row.english_name,
                    firstName: row.first_name,
                    lastName: row.last_name,
                })
                : row.english_name,
        }),
        clientType: row.client_type,
    }));
}

const activeClientTypeFilter = (typeText: string) =>
    typeText.trim() === ""
        ? `client_type = 'Member'`
        : "client_type = ?";

const activeClientTypeParams = (typeText: string) =>
    typeText.trim() === "" ? [] : ["Member"];

export async function searchActiveMembers(
    db: AppDb,
    search: string,
    limit: number,
    clientType: string = "Member",
    options: { includeLegalName?: boolean } = {},
): Promise<{
    options: DropdownSearchItem[];
    exactMatch: DropdownSearchItem | null;
    exactMatchCount: number;
}> {
    const normalizedSearch = search.trim();
    if (!normalizedSearch) {
        return { options: [], exactMatch: null, exactMatchCount: 0 };
    }

    const resolvedLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
    const searchQuery = buildChineseNameSearchQuery(normalizedSearch);
    if (clientType === "participant" || clientType === "child_member" || clientType === "Child Member") {
        const includeClients = clientType === "participant";
        const includeChildMembers = true;
        const clientSelect = includeClients
            ? `
        SELECT
            id,
            client_code,
            first_name,
            last_name,
            chinese_name,
            english_name,
            'client' AS participant_type
        FROM clients
        WHERE status = 'active'
          AND client_type = 'Member'
          AND (
            ${clientSearchLikeCondition("", searchQuery)}
          )
        `
            : "";
        const childSelect = includeChildMembers
            ? `
        SELECT
            id,
            child_code AS client_code,
            first_name,
            last_name,
            chinese_name,
            english_name,
            'child_member' AS participant_type
        FROM child_members
        WHERE status = 'active'
          AND (
            ${childMemberSearchLikeCondition("", searchQuery)}
          )
        `
            : "";
        const unionSql = [clientSelect, childSelect].filter(Boolean).join("\nUNION ALL\n");
        const likeParams = [
            ...(includeClients ? clientSearchLikeParams(searchQuery) : []),
            ...(includeChildMembers ? childMemberSearchLikeParams(searchQuery) : []),
        ];
        const exactParams = [
            ...(includeClients ? clientSearchExactParams(searchQuery) : []),
            ...(includeChildMembers ? childMemberSearchExactParams(searchQuery) : []),
        ];

        const rows = await rawAll<{
            id: number;
            client_code: string;
            first_name?: string | null;
            last_name?: string | null;
            chinese_name: string | null;
            english_name: string | null;
            participant_type: string;
        }>(db, {
            reasonKey: "domain.complex-directory-and-search",
            sql: `
        SELECT *
        FROM ( ${unionSql} ) p
        ORDER BY
          CASE
            WHEN UPPER(client_code) = UPPER(?) THEN 0
            WHEN chinese_name = ? THEN 1
            WHEN LOWER(COALESCE(english_name, '')) = LOWER(?) THEN 2
            WHEN LOWER(COALESCE(first_name, '')) = LOWER(?) THEN 2
            WHEN LOWER(COALESCE(last_name, '')) = LOWER(?) THEN 2
            ELSE 4
          END,
          chinese_name ASC,
          client_code ASC
        LIMIT ?
        `,
            params: [
                ...likeParams,
                normalizedSearch,
                normalizedSearch,
                normalizedSearch,
                normalizedSearch,
                normalizedSearch,
                resolvedLimit,
            ],
        });

        const exactRows = await rawAll<{
            id: number;
            client_code: string;
            first_name?: string | null;
            last_name?: string | null;
            chinese_name: string | null;
            english_name: string | null;
            participant_type: string;
        }>(db, {
            reasonKey: "domain.complex-directory-and-search",
            sql: `
        SELECT *
        FROM (
            ${includeClients
                ? `
            SELECT
                id,
                client_code,
                first_name,
                last_name,
                chinese_name,
                english_name,
                'client' AS participant_type
            FROM clients
	            WHERE status = 'active'
	              AND client_type = 'Member'
	              AND (
	                ${clientSearchExactCondition("", searchQuery)}
	              )
            `
                : ""}
            ${includeClients && includeChildMembers ? "UNION ALL" : ""}
            ${includeChildMembers
                ? `
            SELECT
                id,
                child_code AS client_code,
                first_name,
                last_name,
                chinese_name,
                english_name,
                'child_member' AS participant_type
	            FROM child_members
	            WHERE status = 'active'
	              AND (
	                ${childMemberSearchExactCondition("", searchQuery)}
	              )
            `
                : ""}
        ) p
        ORDER BY chinese_name ASC, client_code ASC
        LIMIT 2
        `,
            params: exactParams,
        });

        return {
            options: rows.map((row) => mapMemberSearchItem(row, options)),
            exactMatch: exactRows.length === 1
                ? mapMemberSearchItem(exactRows[0], options)
                : null,
            exactMatchCount: exactRows.length,
        };
    }

    const typeFilterSql = activeClientTypeFilter(clientType);
    const typeParams = activeClientTypeParams(clientType);
    const selectedColumns = "id, client_code, first_name, last_name, chinese_name, english_name";
    const rows = await rawAll<{
        id: number;
        client_code: string;
        first_name?: string | null;
        last_name?: string | null;
        chinese_name: string | null;
        english_name: string | null;
    }>(db, {
        reasonKey: "domain.complex-directory-and-search",
        sql: `
        SELECT ${selectedColumns}
        FROM clients
        WHERE status = 'active'
          AND ${typeFilterSql}
          AND (
            ${clientSearchLikeCondition("", searchQuery)}
          )
        ORDER BY
          CASE
            WHEN UPPER(client_code) = UPPER(?) THEN 0
            WHEN chinese_name = ? THEN 1
            WHEN LOWER(COALESCE(english_name, '')) = LOWER(?) THEN 2
            WHEN LOWER(COALESCE(first_name, '')) = LOWER(?) THEN 2
            WHEN LOWER(COALESCE(last_name, '')) = LOWER(?) THEN 2
            WHEN LOWER(COALESCE(chinese_name_pinyin, '')) = LOWER(?) THEN 3
            WHEN LOWER(COALESCE(chinese_name_pinyin_compact, '')) = LOWER(?) THEN 3
            WHEN LOWER(COALESCE(chinese_name_pinyin_initials, '')) = LOWER(?) THEN 3
            WHEN LOWER(COALESCE(chinese_name_pinyin_given_surname, '')) = LOWER(?) THEN 3
            WHEN COALESCE(chinese_name_search_terms, '') LIKE ? COLLATE NOCASE THEN 3
            ELSE 4
          END,
          chinese_name ASC,
          client_code ASC
        LIMIT ?
        `,
        params: [
            ...typeParams,
            ...clientSearchLikeParams(searchQuery),
            ...clientSearchRankParams(searchQuery),
            resolvedLimit,
        ],
    });

    const exactRows = await rawAll<{
        id: number;
        client_code: string;
        first_name?: string | null;
        last_name?: string | null;
        chinese_name: string | null;
        english_name: string | null;
    }>(db, {
        reasonKey: "domain.complex-directory-and-search",
        sql: `
        SELECT ${selectedColumns}
        FROM clients
        WHERE status = 'active'
          AND ${typeFilterSql}
          AND (
            ${clientSearchExactCondition("", searchQuery)}
          )
        ORDER BY chinese_name ASC, client_code ASC
        LIMIT 2
        `,
        params: [...typeParams, ...clientSearchExactParams(searchQuery)],
    });

    return {
        options: rows.map((row) => mapMemberSearchItem(row, options)),
        exactMatch: exactRows.length === 1 ? mapMemberSearchItem(exactRows[0], options) : null,
        exactMatchCount: exactRows.length,
    };
}

export async function listDesignatedPeople(
    db: AppDb,
    options: { includeUserId?: number | null } = {},
): Promise<Array<{ value: number; label: string }>> {
    const includeUserId =
        typeof options.includeUserId === "number" && options.includeUserId > 0
            ? options.includeUserId
            : null;
    const rows = await db
        .select({
            id: schema.users.id,
            display_name: schema.users.displayName,
            username: schema.users.username,
        })
        .from(schema.users)
        .where(
            includeUserId
                ? or(eq(schema.users.status, "active"), eq(schema.users.id, includeUserId))
                : eq(schema.users.status, "active"),
        )
        .orderBy(asc(sql`COALESCE(${schema.users.displayName}, ${schema.users.username})`));

    return rows.map((row) => ({
        value: row.id,
        label: row.display_name || row.username,
    }));
}

function isMembershipFee(paymentType: string): boolean {
    return paymentType === MEMBERSHIP_FEE_PAYMENT_TYPE;
}

function requiresReceiptRemark(paymentType: string): boolean {
    return paymentType === OTHER_PAYMENT_TYPE;
}

async function receiptInputAppliesToMembershipYear(
    db: AppDb,
    input: ReceiptFormInput,
): Promise<boolean> {
    if (!isMembershipFee(input.paymentType)) return false;
    if (input.payerChildMemberId !== null) return true;
    if (input.payerClientId === null) return false;

    const [client] = await db
        .select({ clientType: schema.clients.clientType })
        .from(schema.clients)
        .where(eq(schema.clients.id, input.payerClientId))
        .limit(1);

    return client?.clientType === "Member";
}

function receiptPayerIdentityFromIds(input: Pick<
    ReceiptFormInput,
    "payerClientId" | "payerChildMemberId" | "payerOrganizationId"
>): ReceiptPayerIdentity | null {
    const payers = [
        { payerType: "client" as const, payerId: input.payerClientId },
        { payerType: "child_member" as const, payerId: input.payerChildMemberId },
        { payerType: "organization" as const, payerId: input.payerOrganizationId },
    ].filter((payer): payer is ReceiptPayerIdentity => payer.payerId !== null);

    if (payers.length === 0) return null;
    if (payers.length > 1) {
        throw new DomainValidationError(m.receiptIncomplete());
    }
    const [payer] = payers;
    if (!Number.isInteger(payer.payerId) || payer.payerId <= 0) {
        throw new DomainValidationError(m.receiptIncomplete());
    }
    return payer;
}

function receiptInputPayerIdentity(input: ReceiptFormInput): ReceiptPayerIdentity | null {
    return receiptPayerIdentityFromIds(input);
}

export function isReceiptRequiredFieldsComplete(input: ReceiptFormInput): boolean {
    if (!input.paymentType || !input.paymentMethod || input.designatedPersonId === null) {
        return false;
    }
    if (!toSqlDate(input.issueDate) || !Number.isFinite(input.amount)) {
        return false;
    }
    if (requiresReceiptRemark(input.paymentType) && !normalizeText(input.remark)) {
        return false;
    }

    try {
        return receiptInputPayerIdentity(input) !== null;
    } catch {
        return false;
    }
}

function assertReceiptRequiredFields<T extends ReceiptFormInput>(
    input: T,
): asserts input is T & { designatedPersonId: number } {
    if (!isReceiptRequiredFieldsComplete(input)) {
        throw new DomainValidationError(m.receiptIncomplete());
    }
}

function receiptPayersMatch(
    left: ReceiptPayerIdentity | null | undefined,
    right: ReceiptPayerIdentity | null,
): boolean {
    return Boolean(
        left &&
            right &&
            left.payerType === right.payerType &&
            left.payerId === right.payerId,
    );
}

async function receiptPayerStatus(
    db: AppDb,
    payer: ReceiptPayerIdentity,
): Promise<string | null> {
    if (payer.payerType === "client") {
        const [client] = await db
            .select({ status: schema.clients.status })
            .from(schema.clients)
            .where(eq(schema.clients.id, payer.payerId))
            .limit(1);
        return client?.status ?? null;
    }

    if (payer.payerType === "child_member") {
        const [childMember] = await db
            .select({ status: schema.childMembers.status })
            .from(schema.childMembers)
            .where(eq(schema.childMembers.id, payer.payerId))
            .limit(1);
        return childMember?.status ?? null;
    }

    const [organization] = await db
        .select({ status: schema.organizations.status })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, payer.payerId))
        .limit(1);
    return organization?.status ?? null;
}

async function validateReceiptPayerForSave(
    db: AppDb,
    input: ReceiptFormInput,
    options: ReceiptDesignatedPersonValidationOptions = {},
): Promise<void> {
    const payer = receiptInputPayerIdentity(input);
    if (!payer) return;

    const status = await receiptPayerStatus(db, payer);
    if (status === "active") return;
    if (status === "disabled" && receiptPayersMatch(options.allowInactivePayer, payer)) return;

    throw new DomainValidationError(m.receiptIncomplete());
}

export async function normalizeReceiptMembershipYearForSave(
    db: AppDb,
    input: ReceiptFormInput,
): Promise<number | null> {
    if (!(await receiptInputAppliesToMembershipYear(db, input))) {
        return null;
    }
    const membershipYear = cleanMembershipYear(input.membershipYear);
    if (membershipYear === null) {
        throw new DomainValidationError(m.receiptMembershipYearInvalid());
    }
    return membershipYear;
}

export async function validateReceiptForSave(
    db: AppDb,
    input: ReceiptFormInput,
    options: ReceiptDesignatedPersonValidationOptions = {},
): Promise<void> {
    assertReceiptRequiredFields(input);
    assertReceiptPayerIsAllowed(input);
    await validateDesignatedPerson(db, input.designatedPersonId, options);
    await validateReceiptPayerForSave(db, input, options);
    await normalizeReceiptMembershipYearForSave(db, input);
}

export async function createReceipt(
    db: AppDb,
    input: ReceiptFormInput & { receiptNo?: string; attachmentAssetId?: number | null },
): Promise<number> {
    assertReceiptRequiredFields(input);
    assertReceiptPayerIsAllowed(input);
    await validateReceiptPayerForSave(db, input);
    const membershipYear = await normalizeReceiptMembershipYearForSave(db, input);
    await validateDesignatedPerson(db, input.designatedPersonId);

    for (let attempt = 1; attempt <= GENERATED_CODE_MAX_ATTEMPTS; attempt += 1) {
        const receiptNo = input.receiptNo || (await generateNextReceiptNo(db));
        const timestamp = nowSqlDateTime();
        try {
            const result = await db.insert(schema.receipts).values({
                receiptNo,
                payerClientId: input.payerClientId,
                payerChildMemberId: input.payerChildMemberId,
                payerOrganizationId: input.payerOrganizationId,
                attachmentAssetId: input.attachmentAssetId ?? null,
                issueDate: toSqlDate(input.issueDate) ?? nowSqlDate(),
                membershipYear,
                currency: input.currency,
                amount: input.amount,
                paymentType: input.paymentType,
                paymentMethod: input.paymentMethod,
                designatedPersonId: input.designatedPersonId,
                remark: input.remark || null,
                status: "active",
                createdAt: timestamp,
                updatedAt: timestamp,
            } as typeof schema.receipts.$inferInsert);

            return getLastInsertId(result);
        } catch (cause) {
            if (
                !input.receiptNo &&
                attempt < GENERATED_CODE_MAX_ATTEMPTS &&
                isUniqueConstraintError(cause)
            ) {
                continue;
            }
            throw cause;
        }
    }

    throw new Error("Failed to generate a unique receipt number");
}

export async function updateReceipt(
    db: AppDb,
    receiptId: number,
    input: ReceiptFormInput & { attachmentAssetId?: number | null },
): Promise<void> {
    assertReceiptRequiredFields(input);
    assertReceiptPayerIsAllowed(input);
    const existingSaveOptions = await getReceiptSaveValidationOptions(db, receiptId);
    await validateReceiptPayerForSave(db, input, existingSaveOptions);
    const membershipYear = await normalizeReceiptMembershipYearForSave(db, input);
    await validateDesignatedPerson(db, input.designatedPersonId, {
        allowInactiveDesignatedPersonId: existingSaveOptions.allowInactiveDesignatedPersonId,
    });
    const timestamp = nowSqlDateTime();
    await db
        .update(schema.receipts)
        .set({
            payerClientId: input.payerClientId,
            payerChildMemberId: input.payerChildMemberId,
            payerOrganizationId: input.payerOrganizationId,
            attachmentAssetId: input.attachmentAssetId ?? null,
            issueDate: toSqlDate(input.issueDate) ?? nowSqlDate(),
            membershipYear,
            currency: input.currency,
            amount: input.amount,
            paymentType: input.paymentType,
            paymentMethod: input.paymentMethod,
            designatedPersonId: input.designatedPersonId,
            remark: input.remark || null,
            updatedAt: timestamp,
        })
        .where(eq(schema.receipts.id, receiptId));
}

async function getReceiptSaveValidationOptions(
    db: AppDb,
    receiptId: number,
): Promise<ReceiptDesignatedPersonValidationOptions> {
    const [receipt] = await db
        .select({
            designatedPersonId: schema.receipts.designatedPersonId,
            payerClientId: schema.receipts.payerClientId,
            payerChildMemberId: schema.receipts.payerChildMemberId,
            payerOrganizationId: schema.receipts.payerOrganizationId,
        })
        .from(schema.receipts)
        .where(eq(schema.receipts.id, receiptId))
        .limit(1);

    if (!receipt) return {};

    return {
        allowInactiveDesignatedPersonId: receipt.designatedPersonId,
        allowInactivePayer: receiptPayerIdentityFromIds({
            payerClientId: receipt.payerClientId,
            payerChildMemberId: receipt.payerChildMemberId,
            payerOrganizationId: receipt.payerOrganizationId,
        }),
    };
}

async function validateDesignatedPerson(
    db: AppDb,
    userId: number,
    options: ReceiptDesignatedPersonValidationOptions = {},
): Promise<void> {
    const [user] = await db
        .select({
            status: schema.users.status,
        })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
    const allowInactiveDesignatedPersonId =
        typeof options.allowInactiveDesignatedPersonId === "number" &&
            options.allowInactiveDesignatedPersonId > 0
            ? options.allowInactiveDesignatedPersonId
            : null;
    if (!user || (user.status !== "active" && userId !== allowInactiveDesignatedPersonId)) {
        throw new DomainValidationError(m.receiptIncomplete());
    }
}

function assertReceiptPayerIsAllowed(input: ReceiptFormInput): void {
    if (
        input.payerOrganizationId !== null &&
        !isOrganizationReceiptPaymentType(input.paymentType)
    ) {
        throw new DomainValidationError(m.organizationReceiptPaymentTypeInvalid());
    }
}

export async function voidReceipt(
    db: AppDb,
    receiptId: number,
): Promise<void> {
    const timestamp = nowSqlDateTime();
    await db
        .update(schema.receipts)
        .set({ status: "voided", updatedAt: timestamp })
        .where(eq(schema.receipts.id, receiptId));
}

function receiptMembershipYearAppliesToDisplay(input: {
    paymentType: string;
    payerChildMemberId?: number | null;
    clientType?: string | null;
}): boolean {
    return isMembershipFee(input.paymentType) &&
        (input.payerChildMemberId !== null && input.payerChildMemberId !== undefined ||
            input.clientType === "Member" ||
            input.clientType === "Child Member");
}

function displayReceiptMembershipYear(input: {
    membershipYear: number | null;
    paymentType: string;
    payerChildMemberId?: number | null;
    clientType?: string | null;
}): number | null {
    return receiptMembershipYearAppliesToDisplay(input) ? input.membershipYear : null;
}

function mapProjectRow(row: {
    id: number;
    name: string;
    status: "active" | "disabled";
    created_at: string;
    updated_at: string;
}): ProjectListItem {
    return {
        id: row.id,
        name: row.name,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function isCanonicalProjectRow(row: { id: number; name: string; status: "active" | "disabled" }): boolean {
    return row.status === "active" && FIXED_PROJECTS.some((project) =>
        project.id === row.id && project.name === row.name,
    );
}

export async function listProjects(
    db: AppDb,
    sort?: { sort: ProjectListSortField; dir: ProjectListSortDirection },
): Promise<ProjectListItem[]> {
    const rows = await db
        .select({
            id: schema.projects.id,
            name: schema.projects.name,
            status: schema.projects.status,
            created_at: schema.projects.createdAt,
            updated_at: schema.projects.updatedAt,
        })
        .from(schema.projects)
        .where(and(
            eq(schema.projects.status, "active"),
            inArray(schema.projects.id, FIXED_PROJECTS.map((project) => project.id)),
        ))
        .orderBy(
            ...(sort
                ? [
                      sort.dir === "asc"
                          ? asc(schema.projects.name)
                          : desc(schema.projects.name),
                      asc(schema.projects.id),
                  ]
                : [asc(schema.projects.id)]),
        );

    return rows
        .filter(isCanonicalProjectRow)
        .map(mapProjectRow)
        .sort((left, right) => left.id - right.id);
}

export async function getProject(
    db: AppDb,
    projectId: number,
): Promise<ProjectListItem | null> {
    if (!isFixedProjectId(projectId)) return null;
    const [row] = await db
        .select({
            id: schema.projects.id,
            name: schema.projects.name,
            status: schema.projects.status,
            created_at: schema.projects.createdAt,
            updated_at: schema.projects.updatedAt,
        })
        .from(schema.projects)
        .where(and(
            eq(schema.projects.id, projectId),
            eq(schema.projects.status, "active"),
        ))
        .limit(1);

    return row && isCanonicalProjectRow(row) ? mapProjectRow(row) : null;
}

export async function createProject(
    db: AppDb,
    name: string,
): Promise<"created" | "duplicate" | "invalid"> {
    const normalizedName = normalizeProjectName(name);
    if (!normalizedName) return "invalid";

    const [existing] = await db
        .select({ id: schema.projects.id, status: schema.projects.status })
        .from(schema.projects)
        .where(eq(schema.projects.name, normalizedName))
        .limit(1);
    if (existing?.status === "active") return "duplicate";

    const timestamp = nowSqlDateTime();
    if (existing?.status === "disabled") {
        await db
            .update(schema.projects)
            .set({ status: "active", updatedAt: timestamp })
            .where(eq(schema.projects.id, existing.id));
        return "created";
    }

    await db.insert(schema.projects).values({
        name: normalizedName,
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
    });

    return "created";
}

export async function renameProject(
    db: AppDb,
    input: {
        projectId: number;
        name: string;
    },
): Promise<"renamed" | "duplicate" | "invalid"> {
    const normalizedName = normalizeProjectName(input.name);
    if (!Number.isInteger(input.projectId) || input.projectId <= 0 || !normalizedName) {
        return "invalid";
    }

    const [duplicate] = await db
        .select({ id: schema.projects.id })
        .from(schema.projects)
        .where(
            and(
                eq(schema.projects.name, normalizedName),
                eq(schema.projects.status, "active"),
                ne(schema.projects.id, input.projectId),
            ),
        )
        .limit(1);
    if (duplicate) return "duplicate";

    const timestamp = nowSqlDateTime();
    const result = await db
        .update(schema.projects)
        .set({ name: normalizedName, updatedAt: timestamp })
        .where(and(eq(schema.projects.id, input.projectId), eq(schema.projects.status, "active")));

    return result.meta.changes ? "renamed" : "invalid";
}

type ProjectDeleteState = {
    status: "active" | "disabled";
    remaining_references: number;
    ceiling_references: number;
};

type ProjectDeleteInitialState = Pick<ProjectDeleteState, "status">;

async function reconcileProjectDelete(
    db: AppDb,
    projectId: number,
): Promise<ProjectDeleteOutcome> {
    try {
        const state = await rawFirst<ProjectDeleteState>(db, {
            reasonKey: "project.atomic-disable-and-unlink",
            sql: `SELECT project.status,
                    (SELECT COUNT(*) FROM activities WHERE project_id = project.id)
                        AS remaining_references,
                    (SELECT COUNT(*) FROM activities
                        WHERE project_id = project.id AND edit_revision >= ?)
                        AS ceiling_references
                FROM projects project
                WHERE project.id = ?
                LIMIT 1`,
            params: [MAX_ACTIVITY_EDIT_REVISION, projectId],
        });
        if (!state) return { status: "not_found" };

        const remainingReferences = Number(state.remaining_references);
        const ceilingReferences = Number(state.ceiling_references);
        if (state.status === "disabled" && remainingReferences === 0) {
            return { status: "not_found" };
        }
        if (
            state.status === "active" &&
            remainingReferences > 0 &&
            ceilingReferences > 0
        ) {
            return { status: "revision_ceiling" };
        }
        return { status: "unconfirmed" };
    } catch {
        return { status: "unconfirmed" };
    }
}

export async function deleteProject(
    db: AppDb,
    projectId: number,
): Promise<ProjectDeleteOutcome> {
    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
        return { status: "not_found" };
    }

    let initialState: ProjectDeleteInitialState | null;
    try {
        initialState = await rawFirst<ProjectDeleteInitialState>(db, {
            reasonKey: "project.atomic-disable-and-unlink",
            sql: `SELECT status FROM projects WHERE id = ? LIMIT 1`,
            params: [projectId],
        });
    } catch {
        return { status: "unconfirmed" };
    }
    if (!initialState || initialState.status !== "active") {
        return { status: "not_found" };
    }

    const timestamp = nowSqlDateTime();
    try {
        const [, projectUpdate] = await rawBatch(db, {
            reasonKey: "project.atomic-disable-and-unlink",
            statements: [
                {
                    sql: `UPDATE activities
                        SET project_id = NULL, edit_revision = edit_revision + 1,
                            updated_at = ?
                        WHERE project_id = ?
                        AND EXISTS (
                            SELECT 1 FROM projects
                            WHERE id = ? AND status = 'active'
                        )
                        AND NOT EXISTS (
                            SELECT 1 FROM activities
                            WHERE project_id = ? AND edit_revision >= ?
                        )`,
                    params: [
                        timestamp,
                        projectId,
                        projectId,
                        projectId,
                        MAX_ACTIVITY_EDIT_REVISION,
                    ],
                },
                {
                    sql: `UPDATE projects
                        SET status = 'disabled', updated_at = ?
                        WHERE id = ? AND status = 'active'
                        AND NOT EXISTS (
                            SELECT 1 FROM activities WHERE project_id = ?
                        )`,
                    params: [timestamp, projectId, projectId],
                },
            ],
        });
        if (Number(projectUpdate?.meta.changes ?? 0) === 1) {
            return { status: "deleted" };
        }
    } catch {
        return { status: "unconfirmed" };
    }
    return reconcileProjectDelete(db, projectId);
}

function formatPayerLabel(input: {
    code: string | null;
    chineseName: string | null;
    englishName: string | null;
}): string {
    const name = input.chineseName || input.englishName || "";
    if (!name && !input.code) return "";
    const english = input.chineseName && input.englishName ? ` / ${input.englishName}` : "";
    const code = input.code ? ` (${input.code})` : "";
    return `${name}${english}${code}`;
}

type ReceiptListOptions = {
    search?: string;
    paymentType?: string;
};

function receiptListFilters(options: ReceiptListOptions): SQL[] {
    const search = options.search?.trim() ?? "";
    const searchQuery = buildChineseNameSearchQuery(search);
    const paymentType = options.paymentType?.trim() ?? "";
    const filters: SQL[] = [];
    if (paymentType) {
        filters.push(eq(schema.receipts.paymentType, paymentType));
    }
    if (search) {
        filters.push(
            or(
                ...searchQuery.likePatterns.map((searchLike) =>
                    like(schema.receipts.receiptNo, searchLike),
                ),
                clientSearchLikeExpression(schema.clients, searchQuery),
                childMemberSearchLikeExpression(schema.childMembers, searchQuery),
                organizationSearchLikeExpression(schema.organizations, searchQuery),
                ...searchQuery.likePatterns.map((searchLike) =>
                    like(schema.receipts.remark, searchLike),
                ),
            )!,
        );
    }

    return filters;
}

function receiptPayerChineseNameExpression(): SQL<string | null> {
    return sql<string | null>`COALESCE(
        NULLIF(TRIM(${schema.clients.chineseName}), ''),
        NULLIF(TRIM(${schema.childMembers.chineseName}), ''),
        NULLIF(TRIM(${schema.organizations.chineseName}), '')
    )`;
}

function receiptPayerEnglishNameExpression(): SQL<string | null> {
    return sql<string | null>`COALESCE(
        NULLIF(TRIM(${schema.clients.englishName}), ''),
        NULLIF(TRIM(${schema.clients.firstName} || ' ' || COALESCE(${schema.clients.lastName}, '')), ''),
        NULLIF(TRIM(${schema.childMembers.englishName}), ''),
        NULLIF(TRIM(${schema.organizations.englishName}), '')
    )`;
}

function mapReceiptListItem(row: {
    id: number;
    receipt_no: string;
    payer_client_id: number | null;
    payer_child_member_id: number | null;
    payer_organization_id: number | null;
    organization_code: string | null;
    client_code: string | null;
    client_type: string | null;
    child_code: string | null;
    chinese_name: string | null;
    english_name: string | null;
    issue_date: string;
    membership_year: number | null;
    currency: string;
    amount: string | number;
    payment_type: string;
    payment_method: string;
    designated_person_id: number | null;
    designated_person: string;
    remark: string | null;
    status: string;
    attachment_asset_id: number | null;
}): ReceiptListItem {
    return {
        id: row.id,
        receiptNo: row.receipt_no,
        payerClientId: row.payer_client_id,
        payerChildMemberId: row.payer_child_member_id,
        payerOrganizationId: row.payer_organization_id,
        payerType: row.payer_organization_id
            ? "organization"
            : row.payer_child_member_id
                ? "child_member"
                : row.payer_client_id ? "client" : null,
        payerId: row.payer_organization_id ?? row.payer_child_member_id ?? row.payer_client_id,
        payerCode: row.organization_code ?? row.child_code ?? row.client_code,
        payerChineseName: row.chinese_name,
        payerEnglishName: row.english_name,
        payerLabel: formatPayerLabel({
            code: row.organization_code ?? row.child_code ?? row.client_code,
            chineseName: row.chinese_name,
            englishName: row.english_name,
        }),
        issueDate: toSqlDate(row.issue_date) ?? row.issue_date,
        membershipYear: displayReceiptMembershipYear({
            membershipYear: row.membership_year,
            paymentType: row.payment_type,
            payerChildMemberId: row.payer_child_member_id,
            clientType: row.client_type,
        }),
        currency: row.currency,
        amount: Number(row.amount),
        paymentType: row.payment_type,
        paymentMethod: row.payment_method,
        designatedPersonId: row.designated_person_id,
        designatedPerson: row.designated_person,
        remark: row.remark,
        status: row.status,
        attachmentAssetId: row.attachment_asset_id,
    };
}

export async function listReceipts(
    db: AppDb,
    options: ReceiptListOptions = {},
): Promise<ReceiptListItem[]> {
    const filters = receiptListFilters(options);

    const rows = await db
        .select({
            id: schema.receipts.id,
            receipt_no: schema.receipts.receiptNo,
            payer_client_id: schema.receipts.payerClientId,
            payer_child_member_id: schema.receipts.payerChildMemberId,
            payer_organization_id: schema.receipts.payerOrganizationId,
            organization_code: schema.organizations.organizationCode,
            client_code: schema.clients.clientCode,
            client_type: schema.clients.clientType,
            child_code: schema.childMembers.childCode,
            chinese_name: receiptPayerChineseNameExpression(),
            english_name: receiptPayerEnglishNameExpression(),
            issue_date: schema.receipts.issueDate,
            membership_year: schema.receipts.membershipYear,
            currency: schema.receipts.currency,
            amount: schema.receipts.amount,
            payment_type: schema.receipts.paymentType,
            payment_method: schema.receipts.paymentMethod,
            designated_person_id: schema.receipts.designatedPersonId,
            designated_person: sql<string>`COALESCE(${schema.users.displayName}, ${schema.users.username}, '')`,
            remark: schema.receipts.remark,
            status: schema.receipts.status,
            attachment_asset_id: schema.receipts.attachmentAssetId,
        })
        .from(schema.receipts)
        .leftJoin(schema.clients, eq(schema.clients.id, schema.receipts.payerClientId))
        .leftJoin(
            schema.childMembers,
            eq(schema.childMembers.id, schema.receipts.payerChildMemberId),
        )
        .leftJoin(
            schema.organizations,
            eq(schema.organizations.id, schema.receipts.payerOrganizationId),
        )
        .leftJoin(schema.users, eq(schema.users.id, schema.receipts.designatedPersonId))
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(schema.receipts.issueDate), desc(schema.receipts.id));

    return rows.map(mapReceiptListItem);
}

export async function listReceiptsPage(
    db: AppDb,
    options: ReceiptListOptions & {
        page: number;
        limit: number;
    },
): Promise<{ rows: ReceiptListItem[]; total: number }> {
    const filters = receiptListFilters(options);
    const page = Math.max(options.page, 1);
    const limit = Math.max(options.limit, 1);
    const offset = (page - 1) * limit;

    const [countRow] = await db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.receipts)
        .leftJoin(schema.clients, eq(schema.clients.id, schema.receipts.payerClientId))
        .leftJoin(
            schema.childMembers,
            eq(schema.childMembers.id, schema.receipts.payerChildMemberId),
        )
        .leftJoin(
            schema.organizations,
            eq(schema.organizations.id, schema.receipts.payerOrganizationId),
        )
        .where(filters.length > 0 ? and(...filters) : undefined);

    const rows = await db
        .select({
            id: schema.receipts.id,
            receipt_no: schema.receipts.receiptNo,
            payer_client_id: schema.receipts.payerClientId,
            payer_child_member_id: schema.receipts.payerChildMemberId,
            payer_organization_id: schema.receipts.payerOrganizationId,
            organization_code: schema.organizations.organizationCode,
            client_code: schema.clients.clientCode,
            client_type: schema.clients.clientType,
            child_code: schema.childMembers.childCode,
            chinese_name: receiptPayerChineseNameExpression(),
            english_name: receiptPayerEnglishNameExpression(),
            issue_date: schema.receipts.issueDate,
            membership_year: schema.receipts.membershipYear,
            currency: schema.receipts.currency,
            amount: schema.receipts.amount,
            payment_type: schema.receipts.paymentType,
            payment_method: schema.receipts.paymentMethod,
            designated_person_id: schema.receipts.designatedPersonId,
            designated_person: sql<string>`COALESCE(${schema.users.displayName}, ${schema.users.username}, '')`,
            remark: schema.receipts.remark,
            status: schema.receipts.status,
            attachment_asset_id: schema.receipts.attachmentAssetId,
        })
        .from(schema.receipts)
        .leftJoin(schema.clients, eq(schema.clients.id, schema.receipts.payerClientId))
        .leftJoin(
            schema.childMembers,
            eq(schema.childMembers.id, schema.receipts.payerChildMemberId),
        )
        .leftJoin(
            schema.organizations,
            eq(schema.organizations.id, schema.receipts.payerOrganizationId),
        )
        .leftJoin(schema.users, eq(schema.users.id, schema.receipts.designatedPersonId))
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(schema.receipts.issueDate), desc(schema.receipts.id))
        .limit(limit)
        .offset(offset);

    return {
        rows: rows.map(mapReceiptListItem),
        total: Number(countRow?.total ?? 0),
    };
}

export async function getReceiptDetail(
    db: AppDb,
    receiptId: number,
): Promise<ReceiptDetail | null> {
    const [row] = await db
        .select({
            id: schema.receipts.id,
            receipt_no: schema.receipts.receiptNo,
            payer_client_id: schema.receipts.payerClientId,
            payer_child_member_id: schema.receipts.payerChildMemberId,
            payer_organization_id: schema.receipts.payerOrganizationId,
            chinese_name: receiptPayerChineseNameExpression(),
            english_name: receiptPayerEnglishNameExpression(),
            client_code: schema.clients.clientCode,
            child_code: schema.childMembers.childCode,
            organization_code: schema.organizations.organizationCode,
            client_type: sql<string | null>`CASE WHEN ${schema.organizations.id} IS NOT NULL THEN 'Organization' WHEN ${schema.childMembers.id} IS NOT NULL THEN 'Child Member' ELSE ${schema.clients.clientType} END`,
            membership_type: sql<string | null>`COALESCE(${schema.clients.membershipType}, ${schema.childMembers.membershipType})`,
            issue_date: schema.receipts.issueDate,
            membership_year: schema.receipts.membershipYear,
            currency: schema.receipts.currency,
            amount: schema.receipts.amount,
            payment_type: schema.receipts.paymentType,
            payment_method: schema.receipts.paymentMethod,
            designated_person_id: schema.receipts.designatedPersonId,
            designated_person: sql<string>`COALESCE(${schema.users.displayName}, ${schema.users.username}, '')`,
            remark: schema.receipts.remark,
            status: schema.receipts.status,
            attachment_asset_id: schema.receipts.attachmentAssetId,
            original_name: schema.receiptAssets.originalName,
            r2_key: schema.receiptAssets.r2Key,
            updated_at: schema.receipts.updatedAt,
        })
        .from(schema.receipts)
        .leftJoin(schema.clients, eq(schema.clients.id, schema.receipts.payerClientId))
        .leftJoin(
            schema.childMembers,
            eq(schema.childMembers.id, schema.receipts.payerChildMemberId),
        )
        .leftJoin(
            schema.organizations,
            eq(schema.organizations.id, schema.receipts.payerOrganizationId),
        )
        .leftJoin(schema.users, eq(schema.users.id, schema.receipts.designatedPersonId))
        .leftJoin(
            schema.receiptAssets,
            eq(schema.receiptAssets.id, schema.receipts.attachmentAssetId),
        )
        .where(eq(schema.receipts.id, receiptId))
        .limit(1);

    if (!row) return null;

    return {
        id: row.id,
        receiptNo: row.receipt_no,
        payerClientId: row.payer_client_id,
        payerChildMemberId: row.payer_child_member_id,
        payerOrganizationId: row.payer_organization_id,
        payerType: row.payer_organization_id
            ? "organization"
            : row.payer_child_member_id
                ? "child_member"
                : row.payer_client_id ? "client" : null,
        payerId: row.payer_organization_id ?? row.payer_child_member_id ?? row.payer_client_id,
        payerCode: row.organization_code ?? row.child_code ?? row.client_code,
        payerChineseName: row.chinese_name,
        payerEnglishName: row.english_name,
        payerLabel: formatPayerLabel({
            code: row.organization_code ?? row.child_code ?? row.client_code,
            chineseName: row.chinese_name,
            englishName: row.english_name,
        }),
        clientCode: row.organization_code ?? row.child_code ?? row.client_code,
        clientType: row.client_type,
        membershipType: row.membership_type,
        issueDate: toSqlDate(row.issue_date) ?? row.issue_date,
        membershipYear: displayReceiptMembershipYear({
            membershipYear: row.membership_year,
            paymentType: row.payment_type,
            payerChildMemberId: row.payer_child_member_id,
            clientType: row.client_type,
        }),
        currency: row.currency,
        amount: row.amount,
        paymentType: row.payment_type,
        paymentMethod: row.payment_method,
        designatedPersonId: row.designated_person_id,
        designatedPerson: row.designated_person,
        remark: row.remark,
        status: row.status,
        attachmentAssetId: row.attachment_asset_id,
        attachmentName: row.original_name,
        attachmentKey: row.r2_key,
        updatedAt: row.updated_at,
    };
}

function activityRegistrationCounts(db: AppDb) {
    return db
        .select({
            activityId: schema.activityRegistrations.activityId,
            count: sql<number>`COUNT(*)`.as("registration_count"),
        })
        .from(schema.activityRegistrations)
        .where(eq(schema.activityRegistrations.registrationStatus, "active"))
        .groupBy(schema.activityRegistrations.activityId)
        .as("activity_registration_counts");
}

function activityWaitlistCounts(db: AppDb) {
    return db
        .select({
            activityId: schema.activityRegistrations.activityId,
            count: sql<number>`COUNT(*)`.as("waitlist_count"),
        })
        .from(schema.activityRegistrations)
        .where(eq(schema.activityRegistrations.registrationStatus, "waitlisted"))
        .groupBy(schema.activityRegistrations.activityId)
        .as("activity_waitlist_counts");
}

function activityAttendanceCounts(db: AppDb) {
    return db
        .select({
            activityId: schema.activityAttendance.activityId,
            count: sql<number>`COUNT(*)`.as("attendance_count"),
        })
        .from(schema.activityAttendance)
        .where(eq(schema.activityAttendance.attendanceStatus, "active"))
        .groupBy(schema.activityAttendance.activityId)
        .as("activity_attendance_counts");
}

function getActivitySortExpression(
    sortField: ActivityListSortField,
    counts: { registration: SQL<number>; attendance: SQL<number> },
) {
    switch (sortField) {
        case "name":
            return schema.activities.name;
        case "project_id":
            return schema.projects.name;
        case "created_at":
            return schema.activities.createdAt;
        case "held_at":
            return schema.activities.heldAt;
        case "expected_participants":
            return schema.activities.expectedParticipants;
        case "registration_count":
            return counts.registration;
        case "attendance_count":
            return counts.attendance;
    }
}

function mapActivityListRow(row: {
    id: number;
    name: string;
    description: string | null;
    project_id: number | null;
    image_asset_id: number | null;
    held_at: string | null;
    expected_participants: number;
    waitlist_percentage: number;
    require_registration_for_check_in: boolean;
    status: "active" | "disabled";
    edit_revision: number;
    created_at: string;
    updated_at: string;
    registration_count: number;
    attendance_count: number;
}): ActivityListItem {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        project_id: row.project_id,
        image_asset_id: row.image_asset_id,
        held_at: row.held_at,
        expected_participants: row.expected_participants,
        waitlist_percentage: row.waitlist_percentage,
        require_registration_for_check_in: row.require_registration_for_check_in,
        status: row.status,
        edit_revision: row.edit_revision,
        created_at: row.created_at,
        updated_at: row.updated_at,
        registration_count: Number(row.registration_count ?? 0),
        attendance_count: Number(row.attendance_count ?? 0),
    };
}

export async function createActivity(
    db: AppDb,
    input: ActivityFormInput,
): Promise<number> {
    await validateActivityForSave(db, input);

    const timestamp = nowSqlDateTime();
    const result = await rawRun(db, {
        reasonKey: "activity.create-active-project",
        sql: `INSERT INTO activities
            (name, description, project_id, image_asset_id, held_at,
                expected_participants, waitlist_percentage, require_registration_for_check_in,
                integrity_enabled, questions, status, created_at, updated_at)
            SELECT ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'active', ?, ?
            WHERE ? IS NULL OR EXISTS (
                SELECT 1 FROM projects WHERE id = ? AND status = 'active'
            )`,
        params: [
            input.name,
            input.description || null,
            input.projectId,
            input.heldAt,
            input.expectedParticipants,
            input.waitlistPercentage,
            input.requireRegistrationForCheckIn ? 1 : 0,
            input.integrityEnabled ? 1 : 0,
            JSON.stringify(input.questions),
            timestamp,
            timestamp,
            input.projectId,
            input.projectId,
        ],
    });

    const activityId = getLastInsertId(result);
    const changes = Number(result.meta.changes ?? 0);
    if (changes === 1 && activityId > 0) return activityId;

    if (changes === 0 && input.projectId !== null) {
        let project: ProjectListItem | null;
        try {
            project = await getProject(db, input.projectId);
        } catch {
            throw new Error("activity_create_failed");
        }
        if (!project) throw new DomainValidationError(m.projectMissingId());
    }

    throw new Error("activity_create_failed");
}

export type ActivityConditionalUpdateInput = ActivityFormInput & {
    activityId: number;
    expectedRevision: number;
    expectedImageAssetId: number | null;
    previousExpectedParticipants?: number;
};

type ActivityUpdateState = {
    name: string;
    description: string | null;
    projectId: number | null;
    imageAssetId: number | null;
    heldAt: string | null;
    expectedParticipants: number;
    waitlistPercentage: number;
    requireRegistrationForCheckIn: boolean;
    integrityEnabled: boolean;
    questions: ActivityQuestionnaire;
    status: "active" | "disabled";
    editRevision: number;
};

async function getActiveActivityRegistrationCount(db: AppDb, activityId: number): Promise<number> {
    const [row] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.activityRegistrations)
        .where(and(
            eq(schema.activityRegistrations.activityId, activityId),
            eq(schema.activityRegistrations.registrationStatus, "active"),
        ));
    return Number(row?.count ?? 0);
}

async function readActivityUpdateState(
    db: AppDb,
    activityId: number,
): Promise<ActivityUpdateState | null> {
    const [row] = await db
        .select({
            name: schema.activities.name,
            description: schema.activities.description,
            projectId: schema.activities.projectId,
            imageAssetId: schema.activities.imageAssetId,
            heldAt: schema.activities.heldAt,
            expectedParticipants: schema.activities.expectedParticipants,
            waitlistPercentage: schema.activities.waitlistPercentage,
            requireRegistrationForCheckIn: schema.activities.requireRegistrationForCheckIn,
            integrityEnabled: schema.activities.integrityEnabled,
            questions: schema.activities.questions,
            status: schema.activities.status,
            editRevision: schema.activities.editRevision,
        })
        .from(schema.activities)
        .where(eq(schema.activities.id, activityId))
        .limit(1);
    return row ?? null;
}

async function activityProjectIsActive(db: AppDb, projectId: number | null): Promise<boolean> {
    if (projectId === null) return true;
    if (!isFixedProjectId(projectId)) return false;
    const [project] = await db
        .select({ id: schema.projects.id })
        .from(schema.projects)
        .where(and(eq(schema.projects.id, projectId), eq(schema.projects.status, "active")))
        .limit(1);
    return Boolean(project);
}

function activityUpdateMatches(
    state: ActivityUpdateState,
    input: ActivityConditionalUpdateInput,
): boolean {
    return state.name === input.name &&
        state.description === (input.description || null) &&
        (input.preserveExistingProjectId || state.projectId === input.projectId) &&
        state.imageAssetId === input.expectedImageAssetId &&
        state.heldAt === input.heldAt &&
        state.expectedParticipants === input.expectedParticipants &&
        state.waitlistPercentage === input.waitlistPercentage &&
        state.requireRegistrationForCheckIn === input.requireRegistrationForCheckIn &&
        state.integrityEnabled === input.integrityEnabled &&
        JSON.stringify(state.questions) === JSON.stringify(input.questions);
}

function isActivityIntegrityPolicyChangeLocked(
    state: Pick<ActivityUpdateState, "heldAt" | "integrityEnabled">,
    nextIntegrityEnabled: boolean,
    nextHeldAt: string | null,
    now = nowSqlDateTime(),
): boolean {
    if (state.heldAt !== null && nextHeldAt === null) {
        const previousDate = addBusinessDateDays(state.heldAt.slice(0, 10), -1);
        return !previousDate || now >= `${previousDate} 22:00:00`;
    }
    if (state.heldAt === null || state.integrityEnabled === nextIntegrityEnabled) return false;
    for (const heldAt of [state.heldAt, nextHeldAt]) {
        if (heldAt === null) continue;
        const previousDate = addBusinessDateDays(heldAt.slice(0, 10), -1);
        if (!previousDate || now >= `${previousDate} 22:00:00`) return true;
    }
    return false;
}

export async function classifyActivityUpdateOutcome(
    db: AppDb,
    input: ActivityConditionalUpdateInput,
    options: { allowConfirmedSuccess: boolean },
): Promise<ActivityUpdateOutcome> {
    const state = await readActivityUpdateState(db, input.activityId);
    if (!state || state.status !== "active") return { status: "not_found" };
    if (
        options.allowConfirmedSuccess &&
        input.expectedRevision < MAX_ACTIVITY_EDIT_REVISION &&
        state.editRevision === input.expectedRevision + 1 &&
        activityUpdateMatches(state, input)
    ) {
        return { status: "updated", revision: state.editRevision };
    }
    if (state.editRevision !== input.expectedRevision) {
        return { status: "conflict", currentRevision: state.editRevision };
    }
    if (state.editRevision === MAX_ACTIVITY_EDIT_REVISION) {
        return { status: "revision_ceiling" };
    }
    if (isActivityIntegrityPolicyChangeLocked(state, input.integrityEnabled, input.heldAt)) {
        return { status: "integrity_locked" };
    }
    const activeRegistrationCount = await getActiveActivityRegistrationCount(db, input.activityId);
    if (input.expectedParticipants < activeRegistrationCount) {
        return { status: "capacity_too_low", activeRegistrationCount };
    }
    if (!input.preserveExistingProjectId && !(await activityProjectIsActive(db, input.projectId))) {
        return { status: "invalid_project" };
    }
    return { status: "unconfirmed" };
}

export async function updateActivity(
    db: AppDb,
    input: ActivityConditionalUpdateInput,
): Promise<ActivityUpdateOutcome> {
    if (!Number.isSafeInteger(input.activityId) || input.activityId <= 0) {
        return { status: "not_found" };
    }
    if (!input.preserveExistingProjectId && input.projectId !== null && !isFixedProjectId(input.projectId)) {
        return { status: "invalid_project" };
    }

    const emptyAnswers: ActivityRegistrationAnswers = {
        answers: input.questions.questions.map((question, index) => ({
            title: question.title,
            type: question.type,
            value: emptyActivityAnswerValues(input.questions)[index] as never,
        })),
    };
    try {
        const timestamp = nowSqlDateTime();
        const promotionStatements = buildActivityCapacityIncreaseStatements({
            ...input,
            timestamp,
        });
        const batch = await rawBatch(db, {
            reasonKey: "activity.update-questionnaire-atomic",
            statements: [
                {
                    sql: `UPDATE activity_registrations SET answers = ?
                        WHERE activity_id = ? AND registration_status IN ('active', 'waitlisted', 'cancelled')
                          AND EXISTS (SELECT 1 FROM activities WHERE id = ? AND status = 'active' AND edit_revision = ? AND edit_revision < ? AND questions <> ?
                              AND ? >= (SELECT COUNT(*) FROM activity_registrations WHERE activity_id = ? AND registration_status = 'active')
                              AND (? = 1 OR ? IS NULL OR EXISTS (SELECT 1 FROM projects WHERE id = ? AND status = 'active' AND id IN (1, 2)))
                              AND (held_at IS NULL
                                  OR (? IS NULL AND ? < datetime(date(held_at), '-1 day', '+22 hours'))
                                  OR (? IS NOT NULL AND (integrity_enabled = ? OR (
                                      ? < datetime(date(held_at), '-1 day', '+22 hours')
                                      AND ? < datetime(date(?), '-1 day', '+22 hours'))))))`,
                        params: [JSON.stringify(emptyAnswers), input.activityId, input.activityId, input.expectedRevision, MAX_ACTIVITY_EDIT_REVISION, JSON.stringify(input.questions), input.expectedParticipants, input.activityId, input.preserveExistingProjectId ? 1 : 0, input.projectId, input.projectId, input.heldAt, timestamp, input.heldAt, input.integrityEnabled ? 1 : 0, timestamp, timestamp, input.heldAt],
                },
                {
                    sql: `UPDATE activities SET name = ?, description = ?, project_id = CASE WHEN ? = 1 THEN project_id ELSE ? END, held_at = ?, expected_participants = ?, waitlist_percentage = ?, require_registration_for_check_in = ?, integrity_enabled = ?, questions = ?, edit_revision = edit_revision + 1, updated_at = ?
                        WHERE id = ? AND status = 'active' AND edit_revision = ? AND edit_revision < ?
                          AND ? >= (SELECT COUNT(*) FROM activity_registrations WHERE activity_id = ? AND registration_status = 'active')
                          AND (? = 1 OR ? IS NULL OR EXISTS (SELECT 1 FROM projects WHERE id = ? AND status = 'active' AND id IN (1, 2)))
                          AND (held_at IS NULL
                              OR (? IS NULL AND ? < datetime(date(held_at), '-1 day', '+22 hours'))
                              OR (? IS NOT NULL AND (integrity_enabled = ? OR (
                                  ? < datetime(date(held_at), '-1 day', '+22 hours')
                                  AND ? < datetime(date(?), '-1 day', '+22 hours')))))`,
                    params: [input.name, input.description || null, input.preserveExistingProjectId ? 1 : 0, input.projectId, input.heldAt, input.expectedParticipants, input.waitlistPercentage, input.requireRegistrationForCheckIn ? 1 : 0, input.integrityEnabled ? 1 : 0, JSON.stringify(input.questions), timestamp, input.activityId, input.expectedRevision, MAX_ACTIVITY_EDIT_REVISION, input.expectedParticipants, input.activityId, input.preserveExistingProjectId ? 1 : 0, input.projectId, input.projectId, input.heldAt, timestamp, input.heldAt, input.integrityEnabled ? 1 : 0, timestamp, timestamp, input.heldAt],
                },
                ...promotionStatements,
            ],
        });
        if (Number(batch[1]?.meta.changes ?? 0) === 1) {
            return { status: "updated", revision: input.expectedRevision + 1 };
        }
    } catch {
        return classifyActivityUpdateOutcome(db, input, { allowConfirmedSuccess: true });
    }
    return classifyActivityUpdateOutcome(db, input, { allowConfirmedSuccess: false });
}

export async function updateActivityProject(
    db: AppDb,
    input: { activityId: number; projectId: number | null; expectedRevision: number },
): Promise<ActivityUpdateOutcome> {
    if (!Number.isSafeInteger(input.activityId) || input.activityId <= 0) {
        return { status: "not_found" };
    }
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision <= 0) {
        return { status: "unconfirmed" };
    }
    if (
        input.projectId !== null &&
        (!Number.isSafeInteger(input.projectId) || !isFixedProjectId(input.projectId))
    ) {
        return { status: "invalid_project" };
    }

    const classify = async (allowConfirmedSuccess: boolean): Promise<ActivityUpdateOutcome> => {
        try {
            const [state] = await db
                .select({
                    projectId: schema.activities.projectId,
                    status: schema.activities.status,
                    editRevision: schema.activities.editRevision,
                })
                .from(schema.activities)
                .where(eq(schema.activities.id, input.activityId))
                .limit(1);
            if (!state || state.status !== "active") return { status: "not_found" };
            if (
                allowConfirmedSuccess &&
                input.expectedRevision < MAX_ACTIVITY_EDIT_REVISION &&
                state.editRevision === input.expectedRevision + 1 &&
                state.projectId === input.projectId
            ) {
                return { status: "updated", revision: state.editRevision };
            }
            if (state.editRevision !== input.expectedRevision) {
                return { status: "conflict", currentRevision: state.editRevision };
            }
            if (state.editRevision === MAX_ACTIVITY_EDIT_REVISION) {
                return { status: "revision_ceiling" };
            }
            if (!(await activityProjectIsActive(db, input.projectId))) {
                return { status: "invalid_project" };
            }
            return { status: "unconfirmed" };
        } catch {
            return { status: "unconfirmed" };
        }
    };
    const projectGate = input.projectId === null
        ? sql`1 = 1`
        : exists(
            db.select({ id: schema.projects.id })
                .from(schema.projects)
                .where(
                    and(
                        eq(schema.projects.id, input.projectId),
                        eq(schema.projects.status, "active"),
                    ),
                ),
        );

    try {
        const result = await db
            .update(schema.activities)
            .set({
                projectId: input.projectId,
                editRevision: sql`${schema.activities.editRevision} + 1`,
                updatedAt: nowSqlDateTime(),
            })
            .where(
                and(
                    eq(schema.activities.id, input.activityId),
                    eq(schema.activities.status, "active"),
                    eq(schema.activities.editRevision, input.expectedRevision),
                    lt(schema.activities.editRevision, MAX_ACTIVITY_EDIT_REVISION),
                    projectGate,
                ),
            );
        const changes = Number(result.meta.changes);
        if (changes === 1) {
            return { status: "updated", revision: input.expectedRevision + 1 };
        }
        return classify(changes !== 0);
    } catch {
        return classify(true);
    }
}

export async function listActivities(
    db: AppDb,
    sort: {
        sort: ActivityListSortField;
        dir: ActivityListSortDirection;
    },
): Promise<ActivityListItem[]> {
    const registrationCounts = activityRegistrationCounts(db);
    const attendanceCounts = activityAttendanceCounts(db);
    const registrationCount = sql<number>`COALESCE(${registrationCounts.count}, 0)`;
    const attendanceCount = sql<number>`COALESCE(${attendanceCounts.count}, 0)`;
    const sortExpression = getActivitySortExpression(sort.sort, {
        registration: registrationCount,
        attendance: attendanceCount,
    }) ?? schema.activities.heldAt;
    const sortOrder = sort.dir === "asc" ? asc(sortExpression) : desc(sortExpression);
    const rows = await db
        .select({
            id: schema.activities.id,
            name: schema.activities.name,
            description: schema.activities.description,
            project_id: schema.activities.projectId,
            image_asset_id: schema.activities.imageAssetId,
            held_at: schema.activities.heldAt,
            expected_participants: schema.activities.expectedParticipants,
            waitlist_percentage: schema.activities.waitlistPercentage,
            require_registration_for_check_in: schema.activities.requireRegistrationForCheckIn,
            status: schema.activities.status,
            edit_revision: schema.activities.editRevision,
            created_at: schema.activities.createdAt,
            updated_at: schema.activities.updatedAt,
            registration_count: registrationCount,
            attendance_count: attendanceCount,
        })
        .from(schema.activities)
        .leftJoin(
            schema.projects,
            eq(schema.projects.id, schema.activities.projectId),
        )
        .leftJoin(
            registrationCounts,
            eq(registrationCounts.activityId, schema.activities.id),
        )
        .leftJoin(
            attendanceCounts,
            eq(attendanceCounts.activityId, schema.activities.id),
        )
        .where(eq(schema.activities.status, "active"))
        .orderBy(sortOrder, desc(schema.activities.id));

    return rows.map(mapActivityListRow);
}

export async function listActivityOptions(
    db: AppDb,
): Promise<Array<{ id: number; name: string; held_at: string | null }>> {
    const rows = await db
        .select({
            id: schema.activities.id,
            name: schema.activities.name,
            held_at: schema.activities.heldAt,
        })
        .from(schema.activities)
        .where(eq(schema.activities.status, "active"))
        .orderBy(desc(schema.activities.heldAt), desc(schema.activities.id));

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        held_at: row.held_at,
    }));
}

export async function getActivityDetail(
    db: AppDb,
    activityId: number,
): Promise<ActivityDetail | null> {
    const registrationCounts = activityRegistrationCounts(db);
    const waitlistCounts = activityWaitlistCounts(db);
    const attendanceCounts = activityAttendanceCounts(db);
    const [row] = await db
        .select({
            id: schema.activities.id,
            name: schema.activities.name,
            description: schema.activities.description,
            project_id: schema.activities.projectId,
            image_asset_id: schema.activities.imageAssetId,
            held_at: schema.activities.heldAt,
            expected_participants: schema.activities.expectedParticipants,
            waitlist_percentage: schema.activities.waitlistPercentage,
            require_registration_for_check_in: schema.activities.requireRegistrationForCheckIn,
            integrity_enabled: schema.activities.integrityEnabled,
            questions: schema.activities.questions,
            status: schema.activities.status,
            edit_revision: schema.activities.editRevision,
            created_at: schema.activities.createdAt,
            updated_at: schema.activities.updatedAt,
            registration_count: sql<number>`COALESCE(${registrationCounts.count}, 0)`,
            waitlist_count: sql<number>`COALESCE(${waitlistCounts.count}, 0)`,
            attendance_count: sql<number>`COALESCE(${attendanceCounts.count}, 0)`,
            original_name: schema.activityAssets.originalName,
            r2_key: schema.activityAssets.r2Key,
        })
        .from(schema.activities)
        .leftJoin(
            schema.activityAssets,
            eq(schema.activityAssets.id, schema.activities.imageAssetId),
        )
        .leftJoin(
            registrationCounts,
            eq(registrationCounts.activityId, schema.activities.id),
        )
        .leftJoin(
            waitlistCounts,
            eq(waitlistCounts.activityId, schema.activities.id),
        )
        .leftJoin(
            attendanceCounts,
            eq(attendanceCounts.activityId, schema.activities.id),
        )
        .where(and(eq(schema.activities.id, activityId), eq(schema.activities.status, "active")))
        .limit(1);

    if (!row) return null;
    return {
        ...mapActivityListRow(row),
        original_name: row.original_name,
        r2_key: row.r2_key,
        integrity_enabled: row.integrity_enabled,
        questions: row.questions,
        waitlist_count: Number(row.waitlist_count ?? 0),
    };
}

function mapActivityParticipantRow(row: {
    id: number;
    client_id: number | null;
    child_member_id: number | null;
    temporary_participant_id: number | null;
    client_code: string;
    chinese_name: string;
    english_name: string | null;
    registration_status: string;
    registered_at: string | null;
    waitlisted_at: string | null;
    answers: ActivityRegistrationAnswers;
    fsii_survey_completed_this_year?: number;
}): ActivityParticipantRecord {
    if (row.registration_status !== "active" && row.registration_status !== "waitlisted") {
        throw new Error("invalid_activity_registration_status");
    }
    return {
        id: row.id,
        participantKey: activityParticipantKey(row),
        clientId: row.client_id,
        childMemberId: row.child_member_id,
        temporaryParticipantId: row.temporary_participant_id,
        clientCode: row.client_code,
        chineseName: row.chinese_name ?? row.client_code,
        englishName: row.english_name,
        registrationStatus: row.registration_status,
        registeredAt: row.registered_at,
        waitlistedAt: row.waitlisted_at,
        answers: row.answers,
        fsiiSurveyCompletedThisYear: row.fsii_survey_completed_this_year === 1,
    };
}

function activityParticipantKey(row: {
    client_id: number | null;
    child_member_id: number | null;
    temporary_participant_id: number | null;
}): string {
    if (row.client_id !== null) return `client:${row.client_id}`;
    if (row.child_member_id !== null) return `child_member:${row.child_member_id}`;
    if (row.temporary_participant_id !== null) {
        return `temporary_participant:${row.temporary_participant_id}`;
    }
    throw new Error("invalid_activity_participant_identity");
}

function attendanceParticipantDisplayNameExpression(codeExpression: SQL<string>): SQL<string> {
    return sql<string>`CASE
        WHEN ${schema.clients.id} IS NOT NULL THEN COALESCE(
            NULLIF(TRIM(${schema.clients.chineseName}), ''),
            NULLIF(TRIM(${schema.clients.englishName}), ''),
            NULLIF(TRIM(${schema.clients.firstName} || ' ' || COALESCE(${schema.clients.lastName}, '')), ''),
            ${codeExpression}
        )
        WHEN ${schema.childMembers.id} IS NOT NULL THEN COALESCE(
            NULLIF(TRIM(${schema.childMembers.chineseName}), ''),
            NULLIF(TRIM(${schema.childMembers.englishName}), ''),
            ${codeExpression}
        )
        ELSE ${codeExpression}
    END`;
}

function attendanceParticipantEnglishNameExpression(): SQL<string | null> {
    return sql<string | null>`COALESCE(
        NULLIF(TRIM(${schema.clients.englishName}), ''),
        NULLIF(TRIM(${schema.clients.firstName} || ' ' || COALESCE(${schema.clients.lastName}, '')), ''),
        NULLIF(TRIM(${schema.childMembers.englishName}), '')
    )`;
}

export function fsiiSurveyCompletedThisYearExpression(
    clientIdExpression: SQLWrapper,
    temporaryParticipantIdExpression: SQLWrapper,
    year: number,
): SQL<number> {
    return sql<number>`EXISTS (
        SELECT 1
        FROM fsii_survey_responses
        WHERE (client_id = ${clientIdExpression} OR temporary_participant_id = ${temporaryParticipantIdExpression})
          AND substr(answered_date, 1, 4) = ${String(year)}
    )`;
}

function activityParticipantDisplayNameExpression(codeExpression: SQL<string>): SQL<string> {
    return sql<string>`CASE
        WHEN ${schema.temporaryParticipants.id} IS NOT NULL THEN COALESCE(
            NULLIF(trim(${schema.temporaryParticipants.firstName}) || ' ' || trim(${schema.temporaryParticipants.lastName}), ''),
            ${codeExpression}
        )
        ELSE ${attendanceParticipantDisplayNameExpression(codeExpression)}
    END`;
}

function activityParticipantEnglishNameExpression(): SQL<string | null> {
    return sql<string>`CASE
        WHEN ${schema.temporaryParticipants.id} IS NOT NULL THEN NULL
        ELSE ${attendanceParticipantEnglishNameExpression()}
    END`;
}

export async function getActivityRegistrations(
    db: AppDb,
    activityId: number,
    options: {
        includeWaitlisted?: boolean;
        includeFsiiSurveyCompletedThisYear?: boolean;
    } = {},
): Promise<ActivityParticipantRecord[]> {
    const rows = await db
        .select({
            id: schema.activityRegistrations.id,
            client_id: schema.activityRegistrations.clientId,
            child_member_id: schema.activityRegistrations.childMemberId,
            temporary_participant_id: schema.activityRegistrations.temporaryParticipantId,
            client_code: schema.activityRegistrations.clientCode,
            chinese_name: activityParticipantDisplayNameExpression(
                sql<string>`${schema.activityRegistrations.clientCode}`,
            ),
            english_name: activityParticipantEnglishNameExpression(),
            registration_status: schema.activityRegistrations.registrationStatus,
            registered_at: schema.activityRegistrations.registeredAt,
            waitlisted_at: schema.activityRegistrations.waitlistedAt,
            answers: schema.activityRegistrations.answers,
            ...(options.includeFsiiSurveyCompletedThisYear
                ? {
                    fsii_survey_completed_this_year: fsiiSurveyCompletedThisYearExpression(
                        sql<number | null>`${schema.activityRegistrations.clientId}`,
                        sql<number | null>`${schema.activityRegistrations.temporaryParticipantId}`,
                        currentBusinessYear(),
                    ),
                }
                : {}),
        })
        .from(schema.activityRegistrations)
        .leftJoin(
            schema.clients,
            eq(schema.clients.id, schema.activityRegistrations.clientId),
        )
        .leftJoin(
            schema.childMembers,
            eq(schema.childMembers.id, schema.activityRegistrations.childMemberId),
        )
        .leftJoin(
            schema.temporaryParticipants,
            eq(
                schema.temporaryParticipants.id,
                schema.activityRegistrations.temporaryParticipantId,
            ),
        )
        .where(
            and(
                eq(schema.activityRegistrations.activityId, activityId),
                options.includeWaitlisted
                    ? inArray(schema.activityRegistrations.registrationStatus, ["active", "waitlisted"])
                    : eq(schema.activityRegistrations.registrationStatus, "active"),
            ),
        )
        .orderBy(
            sql`CASE WHEN ${schema.activityRegistrations.registrationStatus} = 'active' THEN 0 ELSE 1 END`,
            desc(schema.activityRegistrations.registeredAt),
            asc(schema.activityRegistrations.waitlistedAt),
            options.includeWaitlisted
                ? asc(schema.activityRegistrations.id)
                : desc(schema.activityRegistrations.id),
        );

    return rows.map(mapActivityParticipantRow);
}

export async function getActivityAttendanceRecords(
    db: AppDb,
    activityId: number,
    options: {
        includeLatestFsiiSurveyDate?: boolean;
        includeFsiiSurveyCompletedThisYear?: boolean;
    } = {},
): Promise<ActivityAttendanceRecord[]> {
    const rows = await db
        .select({
            id: schema.activityAttendance.id,
            client_id: schema.activityAttendance.clientId,
            child_member_id: schema.activityAttendance.childMemberId,
            temporary_participant_id: schema.activityAttendance.temporaryParticipantId,
            client_code: schema.activityAttendance.clientCode,
            chinese_name: activityParticipantDisplayNameExpression(
                sql<string>`${schema.activityAttendance.clientCode}`,
            ),
            english_name: activityParticipantEnglishNameExpression(),
            registered_at: schema.activityRegistrations.registeredAt,
            attended_at: schema.activityAttendance.attendedAt,
            attendance_status: schema.activityAttendance.attendanceStatus,
            was_registered_when_attended:
                schema.activityAttendance.wasRegisteredWhenAttended,
            ...(options.includeLatestFsiiSurveyDate
                ? {
                    latest_fsii_survey_date: sql<string | null>`(
                        SELECT MAX(answered_date)
                        FROM fsii_survey_responses
                        WHERE client_id = ${schema.activityAttendance.clientId}
                           OR temporary_participant_id = ${schema.activityAttendance.temporaryParticipantId}
                    )`,
                }
                : {}),
            ...(options.includeFsiiSurveyCompletedThisYear
                ? {
                    fsii_survey_completed_this_year: fsiiSurveyCompletedThisYearExpression(
                        sql<number | null>`${schema.activityAttendance.clientId}`,
                        sql<number | null>`${schema.activityAttendance.temporaryParticipantId}`,
                        currentBusinessYear(),
                    ),
                }
                : {}),
        })
        .from(schema.activityAttendance)
        .leftJoin(
            schema.activityRegistrations,
            and(
                eq(schema.activityRegistrations.activityId, schema.activityAttendance.activityId),
                eq(schema.activityRegistrations.clientCode, schema.activityAttendance.clientCode),
                or(
                    eq(schema.activityRegistrations.clientId, schema.activityAttendance.clientId),
                    eq(
                        schema.activityRegistrations.childMemberId,
                        schema.activityAttendance.childMemberId,
                    ),
                    eq(
                        schema.activityRegistrations.temporaryParticipantId,
                        schema.activityAttendance.temporaryParticipantId,
                    ),
                ),
            ),
        )
        .leftJoin(
            schema.clients,
            eq(schema.clients.id, schema.activityAttendance.clientId),
        )
        .leftJoin(
            schema.childMembers,
            eq(schema.childMembers.id, schema.activityAttendance.childMemberId),
        )
        .leftJoin(
            schema.temporaryParticipants,
            eq(
                schema.temporaryParticipants.id,
                schema.activityAttendance.temporaryParticipantId,
            ),
        )
        .where(
            and(
                eq(schema.activityAttendance.activityId, activityId),
                eq(schema.activityAttendance.attendanceStatus, "active"),
            ),
        )
        .orderBy(
            desc(schema.activityAttendance.attendedAt),
            desc(schema.activityAttendance.id),
        );

    return rows.map((row) => ({
        id: row.id,
        participantKey: activityParticipantKey(row),
        clientId: row.client_id,
        childMemberId: row.child_member_id,
        temporaryParticipantId: row.temporary_participant_id,
        clientCode: row.client_code,
        chineseName: row.chinese_name ?? row.client_code,
        englishName: row.english_name,
        registeredAt: row.registered_at,
        attendedAt: row.attended_at ?? "",
        status: row.attendance_status,
        wasRegisteredWhenAttended: row.was_registered_when_attended === 1,
        latestFsiiSurveyDate: options.includeLatestFsiiSurveyDate
            ? ((row as typeof row & { latest_fsii_survey_date?: string | null }).latest_fsii_survey_date ?? null)
            : null,
        fsiiSurveyCompletedThisYear:
            (row as typeof row & { fsii_survey_completed_this_year?: number })
                .fsii_survey_completed_this_year === 1,
    }));
}

export async function getActivityAttendanceCounters(
    db: AppDb,
    activityId: number,
): Promise<ActivityAttendanceCounters> {
    const [registrationRows, attendanceRows] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` })
            .from(schema.activityRegistrations)
            .where(and(
                eq(schema.activityRegistrations.activityId, activityId),
                eq(schema.activityRegistrations.registrationStatus, "active"),
            )),
        db.select({
            count: sql<number>`COUNT(*)`,
            walkInCount: sql<number>`COALESCE(SUM(CASE WHEN ${schema.activityAttendance.wasRegisteredWhenAttended} = 0 THEN 1 ELSE 0 END), 0)`,
        })
            .from(schema.activityAttendance)
            .where(and(
                eq(schema.activityAttendance.activityId, activityId),
                eq(schema.activityAttendance.attendanceStatus, "active"),
            )),
    ]);
    const registrationRow = registrationRows[0];
    const attendanceRow = attendanceRows[0];

    return {
        registrationTotal: Number(registrationRow?.count ?? 0),
        attendanceTotal: Number(attendanceRow?.count ?? 0),
        walkInTotal: Number(attendanceRow?.walkInCount ?? 0),
    };
}

export async function getActivityAttendanceSnapshot(
    db: AppDb,
    activityId: number,
    options: { includeLatestFsiiSurveyDate?: boolean } = {},
): Promise<ActivityAttendanceSnapshot> {
    const [records, counters] = await Promise.all([
        getActivityAttendanceRecords(db, activityId, options),
        getActivityAttendanceCounters(db, activityId),
    ]);

    return { records, counters };
}

async function getActiveParticipantByCode(
    db: AppDb,
    clientCode: string,
): Promise<{
    id: number;
    participant_type: "client" | "child_member";
    chinese_name: string;
    membership_type: string;
    client_type: string;
    status: string;
} | null> {
    const [participant] = await rawAll<{
        id: number;
        participant_type: "client" | "child_member";
        chinese_name: string;
        membership_type: string;
        client_type: string;
        status: string;
    }>(db, {
        reasonKey: "domain.complex-directory-and-search",
        sql: `
        SELECT *
        FROM (
            SELECT
                id,
                'client' AS participant_type,
                CASE
                    WHEN NULLIF(TRIM(chinese_name), '') IS NOT NULL THEN chinese_name
                    WHEN NULLIF(TRIM(english_name), '') IS NOT NULL THEN TRIM(english_name)
                    WHEN NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '') IS NOT NULL THEN TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
                    ELSE client_code
                END AS chinese_name,
                membership_type,
                client_type,
                status
            FROM clients
            WHERE client_code = ?

            UNION ALL

            SELECT
                id,
                'child_member' AS participant_type,
                CASE
                    WHEN NULLIF(TRIM(chinese_name), '') IS NOT NULL THEN chinese_name
                    WHEN NULLIF(TRIM(english_name), '') IS NOT NULL THEN TRIM(english_name)
                    ELSE child_code
                END AS chinese_name,
                membership_type,
                'Member' AS client_type,
                status
            FROM child_members
            WHERE child_code = ?
        )
        LIMIT 1
        `,
        params: [clientCode, clientCode],
    });
    return participant ?? null;
}

export async function registerActivityParticipant(
    db: AppDb,
    input: {
        activityId: number;
        clientCode: string;
    },
): Promise<{ success: boolean; message: string }> {
    const timestamp = nowSqlDateTime();
    const [activity] = await db
        .select({ id: schema.activities.id })
        .from(schema.activities)
        .where(and(eq(schema.activities.id, input.activityId), eq(schema.activities.status, "active")))
        .limit(1);
    if (!activity) {
        return { success: false, message: m.activityNotFound() };
    }

    if (parseTemporaryParticipantCode(input.clientCode) !== null) {
        return { success: false, message: m.attendanceInvalidClient() };
    }

    const client = await getActiveParticipantByCode(db, input.clientCode);
    if (!client || client.status !== "active" || client.client_type !== "Member") {
        return { success: false, message: m.attendanceInvalidClient() };
    }

    const [existing] = await db
        .select({
            id: schema.activityRegistrations.id,
            registration_status: schema.activityRegistrations.registrationStatus,
        })
        .from(schema.activityRegistrations)
        .where(
            and(
                eq(schema.activityRegistrations.activityId, input.activityId),
                eq(schema.activityRegistrations.clientCode, input.clientCode),
            ),
        )
        .limit(1);

    if (existing?.registration_status === "active") {
        return {
            success: false,
            message: m.activityRegistrationDuplicate({ name: client.chinese_name }),
        };
    }

    if (existing) {
        await db
            .update(schema.activityRegistrations)
            .set({
                registrationStatus: "active",
                registeredAt: sql`COALESCE(${schema.activityRegistrations.registeredAt}, ${timestamp})`,
                registrationUpdatedAt: timestamp,
                answers: EMPTY_ACTIVITY_REGISTRATION_ANSWERS,
                updatedAt: timestamp,
            })
            .where(eq(schema.activityRegistrations.id, existing.id));
    } else {
        await db.insert(schema.activityRegistrations).values({
            activityId: input.activityId,
            clientId: client.participant_type === "client" ? client.id : null,
            childMemberId: client.participant_type === "child_member" ? client.id : null,
            clientCode: input.clientCode,
            registrationStatus: "active",
            registeredAt: timestamp,
            registrationUpdatedAt: timestamp,
            answers: EMPTY_ACTIVITY_REGISTRATION_ANSWERS,
            createdAt: timestamp,
            updatedAt: timestamp,
        });
    }

    return {
        success: true,
        message: m.activityRegistrationAdded({ name: client.chinese_name }),
    };
}

export async function unregisterActivityParticipant(
    db: AppDb,
    input: {
        activityId: number;
        clientCode: string;
    },
): Promise<{ success: boolean; message: string }> {
    const timestamp = nowSqlDateTime();
    const [existing] = await db
        .select({
            id: schema.activityRegistrations.id,
            client_id: schema.activityRegistrations.clientId,
            child_member_id: schema.activityRegistrations.childMemberId,
            temporary_participant_id: schema.activityRegistrations.temporaryParticipantId,
            chinese_name: activityParticipantDisplayNameExpression(
                sql<string>`${schema.activityRegistrations.clientCode}`,
            ),
        })
        .from(schema.activityRegistrations)
        .leftJoin(
            schema.clients,
            eq(schema.clients.id, schema.activityRegistrations.clientId),
        )
        .leftJoin(
            schema.childMembers,
            eq(schema.childMembers.id, schema.activityRegistrations.childMemberId),
        )
        .leftJoin(
            schema.temporaryParticipants,
            eq(
                schema.temporaryParticipants.id,
                schema.activityRegistrations.temporaryParticipantId,
            ),
        )
        .where(
            and(
                eq(schema.activityRegistrations.activityId, input.activityId),
                eq(schema.activityRegistrations.clientCode, input.clientCode),
                eq(schema.activityRegistrations.registrationStatus, "active"),
            ),
        )
        .limit(1);

    if (!existing) {
        return { success: false, message: m.activityRegistrationNotFound() };
    }

    const activeAttendance = db
        .select({ value: sql<number>`1` })
        .from(schema.activityAttendance)
        .where(
            and(
                eq(schema.activityAttendance.activityId, input.activityId),
                eq(schema.activityAttendance.clientCode, input.clientCode),
                eq(schema.activityAttendance.attendanceStatus, "active"),
                activityParticipantIdentityPredicate(
                    schema.activityAttendance,
                    existing,
                ),
            ),
        )
        .limit(1);
    const cancellationResult = await db
        .update(schema.activityRegistrations)
        .set({
            registrationStatus: "cancelled",
            registrationUpdatedAt: timestamp,
            updatedAt: timestamp,
        })
        .where(
            and(
                eq(schema.activityRegistrations.id, existing.id),
                eq(schema.activityRegistrations.registrationStatus, "active"),
                notExists(activeAttendance),
            ),
        );

    if (!cancellationResult.meta.changes) {
        const [activeRegistration] = await db
            .select({ id: schema.activityRegistrations.id })
            .from(schema.activityRegistrations)
            .where(
                and(
                    eq(schema.activityRegistrations.id, existing.id),
                    eq(schema.activityRegistrations.registrationStatus, "active"),
                ),
            )
            .limit(1);
        if (!activeRegistration) {
            return { success: false, message: m.activityRegistrationNotFound() };
        }

        return {
            success: false,
            message: m.activityRegistrationActiveAttendance(),
        };
    }

    return {
        success: true,
        message: m.activityRegistrationRemoved({ name: existing.chinese_name }),
    };
}

type ActivityParticipantIdentity = {
    client_id: number | null;
    child_member_id: number | null;
    temporary_participant_id: number | null;
};

function activityParticipantIdentityPredicate(
    table: typeof schema.activityRegistrations | typeof schema.activityAttendance,
    identity: ActivityParticipantIdentity,
): SQL {
    if (identity.client_id !== null) {
        return and(
            eq(table.clientId, identity.client_id),
            isNull(table.childMemberId),
            isNull(table.temporaryParticipantId),
        )!;
    }
    if (identity.child_member_id !== null) {
        return and(
            isNull(table.clientId),
            eq(table.childMemberId, identity.child_member_id),
            isNull(table.temporaryParticipantId),
        )!;
    }
    if (identity.temporary_participant_id !== null) {
        return and(
            isNull(table.clientId),
            isNull(table.childMemberId),
            eq(table.temporaryParticipantId, identity.temporary_participant_id),
        )!;
    }
    throw new Error("invalid_activity_participant_identity");
}

const ACTIVITY_ACTIVE_REGISTRATION_SQL = `SELECT 1 FROM activity_registrations registration
    WHERE registration.activity_id = ? AND registration.client_code = ?
      AND registration.registration_status = 'active'
      AND registration.client_id IS ? AND registration.child_member_id IS ?
      AND registration.temporary_participant_id IS ?`;

const ACTIVITY_ACTIVE_TEMPORARY_PARTICIPANT_SQL = `(
    ? IS NULL OR EXISTS (
        SELECT 1 FROM temporary_participants active_temporary_participant
        WHERE active_temporary_participant.id = ?
          AND active_temporary_participant.status = 'active'
          AND active_temporary_participant.converted_client_id IS NULL
          AND active_temporary_participant.converted_at IS NULL
    )
)`;

const ACTIVITY_CHECK_IN_GATE_SQL = `EXISTS (
    SELECT 1 FROM activities gate_activity
    WHERE gate_activity.id = ? AND gate_activity.status = 'active'
      AND (
        gate_activity.require_registration_for_check_in = 0
        OR EXISTS (${ACTIVITY_ACTIVE_REGISTRATION_SQL})
      )
      AND ${ACTIVITY_ACTIVE_TEMPORARY_PARTICIPANT_SQL}
)`;

function isActivityAttendanceUniqueConflict(cause: unknown): boolean {
    const candidates = [
        cause,
        cause instanceof Error ? cause.cause : undefined,
    ];
    return candidates.some((candidate) => {
        const message = candidate instanceof Error ? candidate.message : String(candidate);
        return isUniqueConstraintError(candidate) && /activity_attendance/i.test(message);
    });
}

function unwrapActivityAttendanceWriteError(cause: unknown): unknown {
    return cause instanceof Error && cause.cause instanceof Error ? cause.cause : cause;
}

function activityRegistrationSqlParams(
    activityId: number,
    clientCode: string,
    identity: ActivityParticipantIdentity,
): Array<number | string | null> {
    return [
        activityId,
        clientCode,
        identity.client_id,
        identity.child_member_id,
        identity.temporary_participant_id,
    ];
}

async function classifyActivityAttendanceWriteFailure(
    db: AppDb,
    input: {
        activityId: number;
        clientCode: string;
        identity: ActivityParticipantIdentity;
        participantName: string;
    },
): Promise<{ checkResult: AttendanceCheckResult; message: string }> {
    const identityParams = [
        input.identity.client_id,
        input.identity.child_member_id,
        input.identity.temporary_participant_id,
    ];
    if (input.identity.temporary_participant_id !== null) {
        const activeTemporaryParticipant = await rawFirst<{ id: number }>(db, {
            reasonKey: "activity.check-in-registration-gate",
            sql: `SELECT id FROM temporary_participants
                WHERE id = ? AND status = 'active'
                  AND converted_client_id IS NULL AND converted_at IS NULL
                LIMIT 1`,
            params: [input.identity.temporary_participant_id],
        });
        if (!activeTemporaryParticipant) {
            return { checkResult: "Invalid", message: m.attendanceInvalidClient() };
        }
    }
    const duplicate = await rawFirst<{ id: number }>(db, {
        reasonKey: "activity.check-in-registration-gate",
        sql: `SELECT id FROM activity_attendance
            WHERE activity_id = ? AND client_code = ? AND attendance_status = 'active'
              AND client_id IS ? AND child_member_id IS ? AND temporary_participant_id IS ?
            LIMIT 1`,
        params: [input.activityId, input.clientCode, ...identityParams],
    });
    if (duplicate) {
        return {
            checkResult: "Duplicated",
            message: m.attendanceDuplicate({ name: input.participantName }),
        };
    }

    const registrationParams = activityRegistrationSqlParams(
        input.activityId,
        input.clientCode,
        input.identity,
    );
    const gateState = await rawFirst<{
        require_registration: number;
        has_active_registration: number;
    }>(db, {
        reasonKey: "activity.check-in-registration-gate",
        sql: `SELECT require_registration_for_check_in AS require_registration,
                CASE WHEN EXISTS (${ACTIVITY_ACTIVE_REGISTRATION_SQL}) THEN 1 ELSE 0 END AS has_active_registration
            FROM activities WHERE id = ? AND status = 'active' LIMIT 1`,
        params: [...registrationParams, input.activityId],
    });
    if (!gateState) {
        return { checkResult: "Invalid", message: m.activityNotFound() };
    }
    if (gateState.require_registration === 1 && gateState.has_active_registration !== 1) {
        return {
            checkResult: "Invalid",
            message: m.activityCheckInRegistrationRequired(),
        };
    }
    throw new Error("activity_attendance_write_unconfirmed");
}

export async function checkInActivityAttendance(
    db: AppDb,
    input: {
        activityId: number;
        clientCode: string;
        dataSource: string;
    },
): Promise<{ checkResult: AttendanceCheckResult; message: string }> {
    const timestamp = nowSqlDateTime();
    const [activity] = await db
        .select({ id: schema.activities.id })
        .from(schema.activities)
        .where(and(eq(schema.activities.id, input.activityId), eq(schema.activities.status, "active")))
        .limit(1);
    if (!activity) {
        return { checkResult: "Invalid", message: m.activityNotFound() };
    }

    const isTemporaryParticipantCode = parseTemporaryParticipantCode(input.clientCode) !== null;
    const temporaryParticipant = isTemporaryParticipantCode
        ? await getActiveTemporaryParticipantByCode(db, input.clientCode)
        : null;
    const client = isTemporaryParticipantCode
        ? null
        : await getActiveParticipantByCode(db, input.clientCode);
    if (
        (!client || client.status !== "active" || client.client_type !== "Member") &&
        !temporaryParticipant
    ) {
        return {
            checkResult: "Invalid",
            message: m.attendanceInvalidClient(),
        };
    }
    const participantName =
        temporaryParticipant?.legalName ?? client?.chinese_name ?? input.clientCode;
    const participantCode = temporaryParticipant?.participantCode ?? input.clientCode;

    const [existing] = await db
        .select({
            id: schema.activityAttendance.id,
            client_id: schema.activityAttendance.clientId,
            child_member_id: schema.activityAttendance.childMemberId,
            temporary_participant_id:
                schema.activityAttendance.temporaryParticipantId,
            attendance_status: schema.activityAttendance.attendanceStatus,
        })
        .from(schema.activityAttendance)
        .where(
            and(
                eq(schema.activityAttendance.activityId, input.activityId),
                eq(schema.activityAttendance.clientCode, participantCode),
            ),
        )
        .limit(1);

    const existingMatchesParticipant = !existing || (temporaryParticipant
        ? existing.temporary_participant_id === temporaryParticipant.id
        : client?.participant_type === "client"
          ? existing.client_id === client.id
          : client?.participant_type === "child_member"
            ? existing.child_member_id === client.id
            : false);
    if (!existingMatchesParticipant) {
        return {
            checkResult: "Invalid",
            message: m.attendanceInvalidClient(),
        };
    }

    if (existing?.attendance_status === "active") {
        return {
            checkResult: "Duplicated",
            message: m.attendanceDuplicate({ name: participantName }),
        };
    }

    const participantIdentity: ActivityParticipantIdentity = {
        client_id: client?.participant_type === "client" ? client.id : null,
        child_member_id: client?.participant_type === "child_member" ? client.id : null,
        temporary_participant_id: temporaryParticipant?.id ?? null,
    };
    const identityParams = [
        participantIdentity.client_id,
        participantIdentity.child_member_id,
        participantIdentity.temporary_participant_id,
    ];
    const registrationParams = activityRegistrationSqlParams(
        input.activityId,
        participantCode,
        participantIdentity,
    );
    const gateParams = [
        input.activityId,
        ...registrationParams,
        participantIdentity.temporary_participant_id,
        participantIdentity.temporary_participant_id,
    ];
    let changes = 0;
    let writeError: unknown = null;
    try {
        const write = existing
            ? await rawRun(db, {
                  reasonKey: "activity.check-in-registration-gate",
                  sql: `UPDATE activity_attendance
                      SET attendance_status = 'active', attended_at = ?, attendance_source = ?,
                          was_registered_when_attended = CASE WHEN EXISTS (${ACTIVITY_ACTIVE_REGISTRATION_SQL}) THEN 1 ELSE 0 END,
                          updated_at = ?
                      WHERE id = ? AND activity_id = ? AND client_code = ?
                        AND client_id IS ? AND child_member_id IS ? AND temporary_participant_id IS ?
                        AND attendance_status = 'voided' AND ${ACTIVITY_CHECK_IN_GATE_SQL}`,
                  params: [
                      timestamp,
                      input.dataSource,
                      ...registrationParams,
                      timestamp,
                      existing.id,
                      input.activityId,
                      participantCode,
                      ...identityParams,
                      ...gateParams,
                  ],
              })
            : await rawRun(db, {
                  reasonKey: "activity.check-in-registration-gate",
                  sql: `INSERT INTO activity_attendance (
                          activity_id, client_id, child_member_id, temporary_participant_id,
                          client_code, attendance_status, attended_at, attendance_source,
                          was_registered_when_attended, created_at, updated_at
                      )
                      SELECT ?, ?, ?, ?, ?, 'active', ?, ?,
                          CASE WHEN EXISTS (${ACTIVITY_ACTIVE_REGISTRATION_SQL}) THEN 1 ELSE 0 END,
                          ?, ?
                      WHERE ${ACTIVITY_CHECK_IN_GATE_SQL}`,
                  params: [
                      input.activityId,
                      ...identityParams,
                      participantCode,
                      timestamp,
                      input.dataSource,
                      ...registrationParams,
                      timestamp,
                      timestamp,
                      ...gateParams,
                  ],
              });
        changes = Number(write.meta.changes ?? 0);
    } catch (cause) {
        writeError = cause;
    }
    if (writeError && !isActivityAttendanceUniqueConflict(writeError)) {
        throw unwrapActivityAttendanceWriteError(writeError);
    }
    if (changes !== 1) {
        return classifyActivityAttendanceWriteFailure(db, {
            activityId: input.activityId,
            clientCode: participantCode,
            identity: participantIdentity,
            participantName,
        });
    }

    return {
        checkResult: "Success",
        message: m.attendanceSuccess({ name: participantName }),
    };
}

export async function manualEnterActivityAttendance(
    db: AppDb,
    input: {
        activityId: number;
        clientCode: string;
        dataSource: string;
    },
): Promise<{ checkResult: AttendanceCheckResult; message: string }> {
    const timestamp = nowSqlDateTime();
    const [activity] = await db
        .select({ id: schema.activities.id })
        .from(schema.activities)
        .where(and(eq(schema.activities.id, input.activityId), eq(schema.activities.status, "active")))
        .limit(1);
    if (!activity) {
        return { checkResult: "Invalid", message: m.activityNotFound() };
    }

    const isTemporaryParticipantCode = parseTemporaryParticipantCode(input.clientCode) !== null;
    const temporaryParticipant = isTemporaryParticipantCode
        ? await getActiveTemporaryParticipantByCode(db, input.clientCode)
        : null;
    const client = isTemporaryParticipantCode
        ? null
        : await getActiveParticipantByCode(db, input.clientCode);
    if (
        (!client || client.status !== "active" || client.client_type !== "Member") &&
        !temporaryParticipant
    ) {
        return { checkResult: "Invalid", message: m.attendanceInvalidClient() };
    }
    const participantName =
        temporaryParticipant?.legalName ?? client?.chinese_name ?? input.clientCode;
    const participantCode = temporaryParticipant?.participantCode ?? input.clientCode;

    const [existingAttendance] = await db
        .select({
            id: schema.activityAttendance.id,
            client_id: schema.activityAttendance.clientId,
            child_member_id: schema.activityAttendance.childMemberId,
            temporary_participant_id: schema.activityAttendance.temporaryParticipantId,
            attendance_status: schema.activityAttendance.attendanceStatus,
        })
        .from(schema.activityAttendance)
        .where(
            and(
                eq(schema.activityAttendance.activityId, input.activityId),
                eq(schema.activityAttendance.clientCode, participantCode),
            ),
        )
        .limit(1);

    const matchesParticipant = (row: ActivityParticipantIdentity): boolean =>
        temporaryParticipant
            ? row.temporary_participant_id === temporaryParticipant.id
            : client?.participant_type === "client"
                ? row.client_id === client.id
                : client?.participant_type === "child_member"
                    ? row.child_member_id === client.id
                    : false;

    if (existingAttendance && !matchesParticipant(existingAttendance)) {
        return { checkResult: "Invalid", message: m.attendanceInvalidClient() };
    }
    if (existingAttendance?.attendance_status === "active") {
        return {
            checkResult: "Duplicated",
            message: m.attendanceDuplicate({ name: participantName }),
        };
    }

    const [existingRegistration] = await db
        .select({
            id: schema.activityRegistrations.id,
            client_id: schema.activityRegistrations.clientId,
            child_member_id: schema.activityRegistrations.childMemberId,
            temporary_participant_id: schema.activityRegistrations.temporaryParticipantId,
            registration_status: schema.activityRegistrations.registrationStatus,
        })
        .from(schema.activityRegistrations)
        .where(
            and(
                eq(schema.activityRegistrations.activityId, input.activityId),
                eq(schema.activityRegistrations.clientCode, participantCode),
            ),
        )
        .limit(1);

    if (existingRegistration && !matchesParticipant(existingRegistration)) {
        return { checkResult: "Invalid", message: m.attendanceInvalidClient() };
    }

    const participantIdentity: ActivityParticipantIdentity = {
        client_id: client?.participant_type === "client" ? client.id : null,
        child_member_id: client?.participant_type === "child_member" ? client.id : null,
        temporary_participant_id: temporaryParticipant?.id ?? null,
    };
    const identityParams = [
        participantIdentity.client_id,
        participantIdentity.child_member_id,
        participantIdentity.temporary_participant_id,
    ];
    const registrationParams = activityRegistrationSqlParams(
        input.activityId,
        participantCode,
        participantIdentity,
    );
    const gateParams = [
        input.activityId,
        ...registrationParams,
        participantIdentity.temporary_participant_id,
        participantIdentity.temporary_participant_id,
    ];

    // Statement A. An already-active registration produces no statement so the
    // original registered_at and questionnaire answers are preserved; a
    // cancelled or waitlisted row is revived without resetting answers.
    const statements: Array<{ sql: string; params: Array<number | string | null> }> = [];
    if (existingRegistration?.registration_status !== "active") {
        if (existingRegistration) {
            statements.push({
                sql: `UPDATE activity_registrations
                    SET registration_status = 'active',
                        registered_at = COALESCE(registered_at, ?),
                        registration_updated_at = ?,
                        updated_at = ?
                    WHERE id = ? AND registration_status != 'active'`,
                params: [timestamp, timestamp, timestamp, existingRegistration.id],
            });
        } else {
            statements.push({
                sql: `INSERT INTO activity_registrations (
                        activity_id, client_id, child_member_id, temporary_participant_id,
                        client_code, registration_status, registered_at, answers,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
                params: [
                    input.activityId,
                    ...identityParams,
                    participantCode,
                    timestamp,
                    JSON.stringify(EMPTY_ACTIVITY_REGISTRATION_ANSWERS),
                    timestamp,
                    timestamp,
                ],
            });
        }
    }

    // Statement B. Always the batch's last element so its affected-row count
    // decides the outcome; statement A is visible to the gate EXISTS in the
    // same atomic batch.
    statements.push(
        existingAttendance
            ? {
                sql: `UPDATE activity_attendance
                    SET attendance_status = 'active', attended_at = ?, attendance_source = ?,
                        was_registered_when_attended = CASE WHEN EXISTS (${ACTIVITY_ACTIVE_REGISTRATION_SQL}) THEN 1 ELSE 0 END,
                        updated_at = ?
                    WHERE id = ? AND activity_id = ? AND client_code = ?
                      AND client_id IS ? AND child_member_id IS ? AND temporary_participant_id IS ?
                      AND attendance_status = 'voided' AND ${ACTIVITY_CHECK_IN_GATE_SQL}`,
                params: [
                    timestamp,
                    input.dataSource,
                    ...registrationParams,
                    timestamp,
                    existingAttendance.id,
                    input.activityId,
                    participantCode,
                    ...identityParams,
                    ...gateParams,
                ],
            }
            : {
                sql: `INSERT INTO activity_attendance (
                        activity_id, client_id, child_member_id, temporary_participant_id,
                        client_code, attendance_status, attended_at, attendance_source,
                        was_registered_when_attended, created_at, updated_at
                    )
                    SELECT ?, ?, ?, ?, ?, 'active', ?, ?,
                        CASE WHEN EXISTS (${ACTIVITY_ACTIVE_REGISTRATION_SQL}) THEN 1 ELSE 0 END,
                        ?, ?
                    WHERE ${ACTIVITY_CHECK_IN_GATE_SQL}`,
                params: [
                    input.activityId,
                    ...identityParams,
                    participantCode,
                    timestamp,
                    input.dataSource,
                    ...registrationParams,
                    timestamp,
                    timestamp,
                    ...gateParams,
                ],
            },
    );

    let changes = 0;
    let writeError: unknown = null;
    try {
        const batch = await rawBatch(db, {
            reasonKey: "activity.manual-entry",
            statements,
        });
        changes = Number(batch[batch.length - 1]?.meta.changes ?? 0);
    } catch (cause) {
        writeError = cause;
    }
    if (writeError && !isActivityAttendanceUniqueConflict(writeError)) {
        throw unwrapActivityAttendanceWriteError(writeError);
    }
    if (changes !== 1) {
        return classifyActivityAttendanceWriteFailure(db, {
            activityId: input.activityId,
            clientCode: participantCode,
            identity: participantIdentity,
            participantName,
        });
    }

    return {
        checkResult: "Success",
        message: m.attendanceSuccess({ name: participantName }),
    };
}

export async function getActivityManualEntryRecords(
    db: AppDb,
    activityId: number,
): Promise<ActivityManualEntryRecord[]> {
    const [registrations, attendanceRecords] = await Promise.all([
        getActivityRegistrations(db, activityId, {
            includeFsiiSurveyCompletedThisYear: true,
        }),
        getActivityAttendanceRecords(db, activityId, {
            includeFsiiSurveyCompletedThisYear: true,
        }),
    ]);

    const recordsByParticipant = new Map<string, ActivityManualEntryRecord>();
    for (const registration of registrations) {
        // Negative ids keep registration-only rows unique as DataTable row keys;
        // they carry no business meaning.
        recordsByParticipant.set(registration.participantKey, {
            id: -registration.id,
            clientId: registration.clientId,
            childMemberId: registration.childMemberId,
            clientCode: registration.clientCode,
            chineseName: registration.chineseName,
            englishName: registration.englishName,
            registeredAt: registration.registeredAt,
            attendedAt: "",
            status: "active",
            fsiiSurveyCompletedThisYear: Boolean(registration.fsiiSurveyCompletedThisYear),
        });
    }

    for (const attendance of attendanceRecords) {
        const existing = recordsByParticipant.get(attendance.participantKey);
        recordsByParticipant.set(attendance.participantKey, {
            id: attendance.id,
            clientId: existing?.clientId ?? attendance.clientId,
            childMemberId: existing?.childMemberId ?? attendance.childMemberId,
            clientCode: existing?.clientCode ?? attendance.clientCode,
            chineseName: existing?.chineseName ?? attendance.chineseName,
            englishName: existing?.englishName ?? attendance.englishName,
            registeredAt: existing?.registeredAt ?? attendance.registeredAt,
            attendedAt: attendance.attendedAt,
            status: attendance.status,
            wasRegisteredWhenAttended: attendance.wasRegisteredWhenAttended,
            fsiiSurveyCompletedThisYear:
                attendance.fsiiSurveyCompletedThisYear ??
                existing?.fsiiSurveyCompletedThisYear ??
                false,
        });
    }

    return [...recordsByParticipant.values()].sort((left, right) => {
        const leftTimestamp = left.attendedAt || left.registeredAt || "";
        const rightTimestamp = right.attendedAt || right.registeredAt || "";
        return (
            rightTimestamp.localeCompare(leftTimestamp) ||
            right.clientCode.localeCompare(left.clientCode) ||
            right.id - left.id
        );
    });
}

export type ActivityBatchEntryOutcome = "ready" | "already" | "not_found" | "disabled";

export type ActivityBatchEntryPreviewRow = {
    clientCode: string;
    name: string;
    outcome: ActivityBatchEntryOutcome;
};

function normalizeBatchEntryCodes(clientCodes: string[]): string[] {
    return clientCodes
        .map((code) => code.trim().toUpperCase())
        .filter((code) => code.length > 0);
}

export async function previewActivityBatchEntry(
    db: AppDb,
    input: { activityId: number; clientCodes: string[] },
): Promise<{ activityMissing: boolean; rows: ActivityBatchEntryPreviewRow[] }> {
    const codes = normalizeBatchEntryCodes(input.clientCodes);

    const [activity] = await db
        .select({ id: schema.activities.id })
        .from(schema.activities)
        .where(
            and(
                eq(schema.activities.id, input.activityId),
                eq(schema.activities.status, "active"),
            ),
        )
        .limit(1);
    if (!activity) {
        return { activityMissing: true, rows: [] };
    }

    const uniqueCodes = [...new Set(codes)];
    const temporaryParticipantIds = uniqueCodes
        .map((code) => parseTemporaryParticipantCode(code))
        .filter((id): id is number => id !== null);

    const clientNameSql = sql<string>`COALESCE(
        NULLIF(TRIM(${schema.clients.chineseName}), ''),
        NULLIF(TRIM(${schema.clients.englishName}), ''),
        NULLIF(TRIM(${schema.clients.firstName} || ' ' || COALESCE(${schema.clients.lastName}, '')), ''),
        ${schema.clients.clientCode}
    )`;
    const childNameSql = sql<string>`COALESCE(
        NULLIF(TRIM(${schema.childMembers.chineseName}), ''),
        NULLIF(TRIM(${schema.childMembers.englishName}), ''),
        ${schema.childMembers.childCode}
    )`;

    const [clientRows, childRows, temporaryRows, attendanceRows] = await Promise.all([
        db
            .select({
                clientCode: schema.clients.clientCode,
                status: schema.clients.status,
                name: clientNameSql,
            })
            .from(schema.clients)
            .where(
                and(
                    inArray(schema.clients.clientCode, uniqueCodes),
                    eq(schema.clients.clientType, "Member"),
                ),
            ),
        db
            .select({
                childCode: schema.childMembers.childCode,
                status: schema.childMembers.status,
                name: childNameSql,
            })
            .from(schema.childMembers)
            .where(inArray(schema.childMembers.childCode, uniqueCodes)),
        db
            .select({
                id: schema.temporaryParticipants.id,
                status: schema.temporaryParticipants.status,
                firstName: schema.temporaryParticipants.firstName,
                lastName: schema.temporaryParticipants.lastName,
            })
            .from(schema.temporaryParticipants)
            .where(inArray(schema.temporaryParticipants.id, temporaryParticipantIds)),
        db
            .select({ clientCode: schema.activityAttendance.clientCode })
            .from(schema.activityAttendance)
            .where(
                and(
                    eq(schema.activityAttendance.activityId, input.activityId),
                    inArray(schema.activityAttendance.clientCode, uniqueCodes),
                    eq(schema.activityAttendance.attendanceStatus, "active"),
                ),
            ),
    ]);

    const clientByCode = new Map(clientRows.map((row) => [row.clientCode, row]));
    const childByCode = new Map(childRows.map((row) => [row.childCode, row]));
    const temporaryById = new Map(temporaryRows.map((row) => [row.id, row]));
    const attendedCodes = new Set(attendanceRows.map((row) => row.clientCode));

    const rows = codes.map((code): ActivityBatchEntryPreviewRow => {
        const temporaryParticipantId = parseTemporaryParticipantCode(code);
        if (temporaryParticipantId !== null) {
            const temporaryParticipant = temporaryById.get(temporaryParticipantId);
            if (!temporaryParticipant) {
                return { clientCode: code, name: "", outcome: "not_found" };
            }
            const name =
                formatTemporaryParticipantLegalName(
                    temporaryParticipant.firstName,
                    temporaryParticipant.lastName,
                ) || code;
            if (temporaryParticipant.status === "disabled") {
                return { clientCode: code, name, outcome: "disabled" };
            }
            return {
                clientCode: code,
                name,
                outcome: attendedCodes.has(code) ? "already" : "ready",
            };
        }

        const client = clientByCode.get(code);
        if (client) {
            if (client.status === "disabled") {
                return { clientCode: code, name: client.name, outcome: "disabled" };
            }
            return {
                clientCode: code,
                name: client.name,
                outcome: attendedCodes.has(code) ? "already" : "ready",
            };
        }

        const child = childByCode.get(code);
        if (child) {
            if (child.status === "disabled") {
                return { clientCode: code, name: child.name, outcome: "disabled" };
            }
            return {
                clientCode: code,
                name: child.name,
                outcome: attendedCodes.has(code) ? "already" : "ready",
            };
        }

        return { clientCode: code, name: "", outcome: "not_found" };
    });

    return { activityMissing: false, rows };
}

export async function batchEnterActivityAttendance(
    db: AppDb,
    input: { activityId: number; clientCodes: string[]; dataSource: string },
): Promise<{
    summary: { success: number; duplicated: number; invalid: number };
    message: string;
}> {
    const codes = normalizeBatchEntryCodes(input.clientCodes);
    let success = 0;
    let duplicated = 0;
    let invalid = 0;

    for (const clientCode of codes) {
        const result = await manualEnterActivityAttendance(db, {
            activityId: input.activityId,
            clientCode,
            dataSource: input.dataSource,
        });
        if (result.checkResult === "Success" || result.checkResult === "Grace") {
            success += 1;
        } else if (result.checkResult === "Duplicated") {
            duplicated += 1;
        } else {
            invalid += 1;
        }
    }

    return {
        summary: { success, duplicated, invalid },
        message: m.activityBatchEntrySummary({ success, duplicated, invalid }),
    };
}

export async function undoActivityAttendance(
    db: AppDb,
    input: {
        activityId: number;
        clientCode: string;
    },
): Promise<{ success: boolean; message: string }> {
    const temporaryParticipantId = parseTemporaryParticipantCode(input.clientCode);
    const temporaryParticipant = temporaryParticipantId === null
        ? null
        : await getTemporaryParticipantById(db, temporaryParticipantId);
    const client = temporaryParticipantId === null
        ? await getActiveParticipantByCode(db, input.clientCode)
        : null;
    const participantCode = temporaryParticipant?.participantCode ?? input.clientCode;
    const participantIdentityPredicate = temporaryParticipant
        ? eq(
              schema.activityAttendance.temporaryParticipantId,
              temporaryParticipant.id,
          )
        : client?.client_type === "Member" && client.participant_type === "client"
          ? eq(schema.activityAttendance.clientId, client.id)
          : client?.client_type === "Member" && client.participant_type === "child_member"
            ? eq(schema.activityAttendance.childMemberId, client.id)
            : null;
    if (!participantIdentityPredicate) {
        return {
            success: false,
            message: m.attendanceRecordNotFound(),
        };
    }

    const timestamp = nowSqlDateTime();
    const [attendance] = await db
        .select({
            id: schema.activityAttendance.id,
            chinese_name: activityParticipantDisplayNameExpression(
                sql<string>`${schema.activityAttendance.clientCode}`,
            ),
        })
        .from(schema.activityAttendance)
        .leftJoin(
            schema.clients,
            eq(schema.clients.id, schema.activityAttendance.clientId),
        )
        .leftJoin(
            schema.childMembers,
            eq(schema.childMembers.id, schema.activityAttendance.childMemberId),
        )
        .leftJoin(
            schema.temporaryParticipants,
            eq(
                schema.temporaryParticipants.id,
                schema.activityAttendance.temporaryParticipantId,
            ),
        )
        .where(
            and(
                eq(schema.activityAttendance.activityId, input.activityId),
                eq(schema.activityAttendance.clientCode, participantCode),
                participantIdentityPredicate,
                eq(schema.activityAttendance.attendanceStatus, "active"),
            ),
        )
        .limit(1);

    if (!attendance) {
        return {
            success: false,
            message: m.attendanceRecordNotFound(),
        };
    }

    await db
        .update(schema.activityAttendance)
        .set({ attendanceStatus: "voided", updatedAt: timestamp })
        .where(eq(schema.activityAttendance.id, attendance.id));

    return {
        success: true,
        message: m.attendanceCancelled({ name: attendance.chinese_name }),
    };
}

export async function listInterestGroups(db: AppDb): Promise<InterestGroupRecord[]> {
    const rows = await db
        .select({
            id: schema.interestGroups.id,
            name: schema.interestGroups.name,
            default_attendance_date: schema.interestGroups.defaultAttendanceDate,
            status: schema.interestGroups.status,
        })
        .from(schema.interestGroups)
        .where(eq(schema.interestGroups.status, "active"))
        .orderBy(asc(schema.interestGroups.name));

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        defaultAttendanceDate: toSqlDate(row.default_attendance_date),
        status: row.status,
    }));
}

export async function listInterestGroupReportYears(db: AppDb): Promise<number[]> {
    const yearExpression = sql<number>`CAST(substr(${schema.attendance.attendanceDate}, 1, 4) AS INTEGER)`;
    const rows = await db
        .select({ year: yearExpression })
        .from(schema.attendance)
        .where(eq(schema.attendance.status, "active"))
        .groupBy(yearExpression)
        .orderBy(asc(yearExpression));

    return rows.map((row) => Number(row.year));
}

export async function getInterestGroupMonthlyReport(
    db: AppDb,
    period: InterestGroupReportPeriod,
): Promise<InterestGroupMonthlyReportRow[]> {
    const { startDate, endDate } = interestGroupReportDateRange(period);
    const attendanceCount = sql<number>`COUNT(${schema.attendance.id})`;
    const uniqueMemberCount = sql<number>`COUNT(DISTINCT ${schema.attendance.clientCode})`;
    const rows = await db
        .select({
            id: schema.interestGroups.id,
            name: schema.interestGroups.name,
            attendance_count: attendanceCount,
            unique_member_count: uniqueMemberCount,
        })
        .from(schema.interestGroups)
        .leftJoin(
            schema.attendance,
            and(
                eq(schema.attendance.interestGroupId, schema.interestGroups.id),
                eq(schema.attendance.status, "active"),
                gte(schema.attendance.attendanceDate, startDate),
                lte(schema.attendance.attendanceDate, endDate),
            ),
        )
        .where(eq(schema.interestGroups.status, "active"))
        .groupBy(schema.interestGroups.id, schema.interestGroups.name)
        .orderBy(asc(schema.interestGroups.name));

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        attendanceCount: Number(row.attendance_count ?? 0),
        uniqueMemberCount: Number(row.unique_member_count ?? 0),
    }));
}

export async function getInterestGroupYearlyReport(
    db: AppDb,
    year: number,
): Promise<InterestGroupYearlyReportRow[]> {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const monthExpression = sql<number | null>`CAST(substr(${schema.attendance.attendanceDate}, 6, 2) AS INTEGER)`;
    const attendanceCount = sql<number>`COUNT(${schema.attendance.id})`;
    const uniqueMemberCount = sql<number>`COUNT(DISTINCT ${schema.attendance.clientCode})`;
    const rows = await db
        .select({
            id: schema.interestGroups.id,
            name: schema.interestGroups.name,
            month: monthExpression,
            attendance_count: attendanceCount,
            unique_member_count: uniqueMemberCount,
        })
        .from(schema.interestGroups)
        .leftJoin(
            schema.attendance,
            and(
                eq(schema.attendance.interestGroupId, schema.interestGroups.id),
                eq(schema.attendance.status, "active"),
                gte(schema.attendance.attendanceDate, startDate),
                lte(schema.attendance.attendanceDate, endDate),
            ),
        )
        .where(eq(schema.interestGroups.status, "active"))
        .groupBy(schema.interestGroups.id, schema.interestGroups.name, monthExpression)
        .orderBy(asc(schema.interestGroups.name), asc(monthExpression));

    const reports = new Map<number, InterestGroupYearlyReportRow>();
    for (const row of rows) {
        let report = reports.get(row.id);
        if (!report) {
            report = {
                id: row.id,
                name: row.name,
                months: Array.from({ length: 12 }, (_, index) => ({
                    month: index + 1,
                    attendanceCount: 0,
                    uniqueMemberCount: 0,
                })),
            };
            reports.set(row.id, report);
        }

        const month = Number(row.month);
        if (month >= 1 && month <= 12) {
            report.months[month - 1] = {
                month,
                attendanceCount: Number(row.attendance_count ?? 0),
                uniqueMemberCount: Number(row.unique_member_count ?? 0),
            };
        }
    }

    return [...reports.values()];
}

export async function createInterestGroup(
    db: AppDb,
    input: {
        name: string;
        defaultAttendanceDate?: string | null;
    },
): Promise<void> {
    const timestamp = nowSqlDateTime();
    await db.insert(schema.interestGroups).values({
        name: input.name,
        defaultAttendanceDate: toSqlDate(input.defaultAttendanceDate ?? null),
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
    });
}

export async function renameInterestGroup(
    db: AppDb,
    input: {
        interestGroupId: number;
        name: string;
    },
): Promise<void> {
    const timestamp = nowSqlDateTime();
    await db
        .update(schema.interestGroups)
        .set({ name: input.name, updatedAt: timestamp })
        .where(eq(schema.interestGroups.id, input.interestGroupId));
}

export async function deleteInterestGroup(
    db: AppDb,
    interestGroupId: number,
): Promise<void> {
    await db
        .delete(schema.attendance)
        .where(eq(schema.attendance.interestGroupId, interestGroupId));

    await db
        .delete(schema.interestGroups)
        .where(eq(schema.interestGroups.id, interestGroupId));
}

export async function getInterestGroupAttendanceRecords(
    db: AppDb,
    interestGroupId: number,
): Promise<InterestGroupAttendanceRecord[]> {
    const attendanceDate = nowSqlDate();
    const businessYear = currentBusinessYear();
    const rows = await db
        .select({
            id: schema.attendance.id,
            client_id: schema.attendance.clientId,
            child_member_id: schema.attendance.childMemberId,
            client_code: schema.attendance.clientCode,
            chinese_name: attendanceParticipantDisplayNameExpression(
                sql<string>`${schema.attendance.clientCode}`,
            ),
            english_name: attendanceParticipantEnglishNameExpression(),
            attended_at: schema.attendance.attendedAt,
            status: schema.attendance.status,
            fsii_survey_completed_this_year: fsiiSurveyCompletedThisYearExpression(
                sql<number | null>`${schema.attendance.clientId}`,
                sql`NULL`,
                businessYear,
            ),
        })
        .from(schema.attendance)
        .leftJoin(schema.clients, eq(schema.clients.id, schema.attendance.clientId))
        .leftJoin(schema.childMembers, eq(schema.childMembers.id, schema.attendance.childMemberId))
        .where(
            and(
                eq(schema.attendance.interestGroupId, interestGroupId),
                eq(sql<string>`date(${schema.attendance.attendanceDate})`, attendanceDate),
                eq(schema.attendance.status, "active"),
            ),
        )
        .orderBy(desc(schema.attendance.attendedAt), desc(schema.attendance.id));

    return rows.map((row) => ({
        id: row.id,
        clientId: row.client_id,
        childMemberId: row.child_member_id,
        clientCode: row.client_code,
        chineseName: row.chinese_name ?? row.client_code,
        englishName: row.english_name,
        attendedAt: row.attended_at,
        status: row.status,
        fsiiSurveyCompletedThisYear: row.fsii_survey_completed_this_year === 1,
    }));
}

export async function getInterestGroupAttendanceCounters(
    db: AppDb,
    interestGroupId: number,
): Promise<AttendanceCounters> {
    const attendanceDate = nowSqlDate();
    const [todayRow] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.attendance)
        .where(
            and(
                eq(schema.attendance.interestGroupId, interestGroupId),
                eq(sql<string>`date(${schema.attendance.attendanceDate})`, attendanceDate),
                eq(schema.attendance.status, "active"),
            ),
        );

    const monthPrefix = attendanceDate.slice(0, 7);
    const [monthRow] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.attendance)
        .where(
            and(
                eq(schema.attendance.interestGroupId, interestGroupId),
                like(sql<string>`date(${schema.attendance.attendanceDate})`, `${monthPrefix}%`),
                eq(schema.attendance.status, "active"),
            ),
        );

    return {
        todayTotal: Number(todayRow?.count ?? 0),
        monthTotal: Number(monthRow?.count ?? 0),
    };
}

export async function getInterestGroupAttendanceSnapshot(
    db: AppDb,
    interestGroupId: number,
): Promise<InterestGroupAttendanceSnapshot> {
    const [records, counters] = await Promise.all([
        getInterestGroupAttendanceRecords(db, interestGroupId),
        getInterestGroupAttendanceCounters(db, interestGroupId),
    ]);

    return { records, counters };
}

async function getLastMembershipYearForPayer(
    db: AppDb,
    payerPredicate: SQL,
): Promise<number | null> {
    const [row] = await db
        .select({
            last_year: sql<number | null>`MAX(${schema.receipts.membershipYear})`,
        })
        .from(schema.receipts)
        .where(
            and(
                payerPredicate,
                eq(schema.receipts.status, "active"),
                eq(schema.receipts.paymentType, MEMBERSHIP_FEE_PAYMENT_TYPE),
            ),
        );
    return row?.last_year ?? null;
}

export async function receiptPaymentAffectsMembership(
    db: AppDb,
    input: ReceiptFormInput,
): Promise<boolean> {
    return receiptInputAppliesToMembershipYear(db, input);
}

export async function getClientLastMembershipYear(
    db: AppDb,
    clientId: number,
): Promise<number | null> {
    return getLastMembershipYearForPayer(db, eq(schema.receipts.payerClientId, clientId));
}

export async function getChildMemberLastMembershipYear(
    db: AppDb,
    childMemberId: number,
): Promise<number | null> {
    return getLastMembershipYearForPayer(db, eq(schema.receipts.payerChildMemberId, childMemberId));
}

/**
 * Looks up the client's last active membership-fee receipt year.
 * Returns the membership year, or null if no active Membership Fee receipt exists.
 */
async function getLastMembershipFeeYear(
    db: AppDb,
    client: ActiveMember,
): Promise<number | null> {
    const payerPredicate = client.participant_type === "child_member"
        ? eq(schema.receipts.payerChildMemberId, client.id)
        : eq(schema.receipts.payerClientId, client.id);
    return getLastMembershipYearForPayer(db, payerPredicate);
}

type ActiveMember = NonNullable<Awaited<ReturnType<typeof getActiveParticipantByCode>>>;

async function resolveAttendanceMembershipResult(
    db: AppDb,
    client: ActiveMember,
): Promise<"Success" | "Grace" | "Invalid"> {
    if (client.participant_type === "child_member") {
        return "Success";
    }

    const lastMembershipYear = await getLastMembershipFeeYear(db, client);
    const state = getMembershipState({
        clientType: client.client_type,
        membershipType: client.membership_type,
        lastMembershipYear,
        currentYear: currentYear(),
    });

    if (state === "expired") {
        return "Invalid";
    }

    return state === "grace" ? "Grace" : "Success";
}

export async function registerInterestGroupAttendance(
    db: AppDb,
    input: {
        interestGroupId: number;
        clientCode: string;
        dataSource: string;
        now?: string;
    },
): Promise<InterestGroupAttendanceRegisterResult> {
    const timestamp = input.now ?? nowSqlDateTime();
    const attendanceDate = timestamp.slice(0, 10) || nowSqlDate();
    const client = await getActiveParticipantByCode(db, input.clientCode);

    if (!client || client.status !== "active") {
        return {
            checkResult: "Invalid",
            message: m.attendanceInvalidClient(),
        };
    }

    const [duplicate] = await db
        .select({
            id: schema.attendance.id,
            attended_at: schema.attendance.attendedAt,
        })
        .from(schema.attendance)
        .where(
            and(
                eq(schema.attendance.interestGroupId, input.interestGroupId),
                eq(sql<string>`date(${schema.attendance.attendanceDate})`, attendanceDate),
                eq(schema.attendance.clientCode, input.clientCode),
                eq(schema.attendance.status, "active"),
            ),
        )
        .orderBy(desc(schema.attendance.attendedAt), desc(schema.attendance.id))
        .limit(1);
    if (duplicate) {
        const duplicateAction = resolveInterestGroupDuplicateCheckInAction({
            attendedAt: duplicate.attended_at,
            now: timestamp,
        });

        if (duplicateAction === "ignore") {
            return {
                checkResult: "Duplicated",
                message: "",
                silent: true,
            };
        }

        if (duplicateAction === "warn") {
            return {
                checkResult: "Duplicated",
                message: m.interestGroupDuplicateCheckInReminder({
                    name: client.chinese_name,
                }),
                reminder: buildInterestGroupDuplicateReminder(),
            };
        }

        if (duplicateAction === "duplicate") {
            return {
                checkResult: "Duplicated",
                message: m.attendanceDuplicate({ name: client.chinese_name }),
            };
        }
    }

    const [interestGroup] = await db
        .select({
            id: schema.interestGroups.id,
            name: schema.interestGroups.name,
        })
        .from(schema.interestGroups)
        .where(eq(schema.interestGroups.id, input.interestGroupId))
        .limit(1);
    if (!interestGroup) {
        return {
            checkResult: "Invalid",
            message: m.interestGroupNotFound(),
        };
    }

    const membershipCheckResult = await resolveAttendanceMembershipResult(db, client);
    if (membershipCheckResult === "Invalid") {
        return {
            checkResult: "Invalid",
            message: m.attendanceExpired(),
        };
    }

    await db.insert(schema.attendance).values({
        interestGroupId: interestGroup.id,
        interestGroupName: interestGroup.name,
        clientId: client.participant_type === "client" ? client.id : null,
        childMemberId: client.participant_type === "child_member" ? client.id : null,
        clientCode: input.clientCode,
        attendanceDate,
        dataSource: input.dataSource,
        attendedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        status: "active",
    });

    return buildSessionAttendanceSuccessResult(membershipCheckResult, client);
}

export async function unregisterInterestGroupAttendance(
    db: AppDb,
    input: {
        interestGroupId: number;
        clientCode?: string;
        attendanceId?: number;
        now?: string;
    },
): Promise<{ success: boolean; message: string; reason?: "not_found" | "undo_expired" }> {
    const timestamp = input.now ?? nowSqlDateTime();
    const attendanceDate = timestamp.slice(0, 10) || nowSqlDate();
    const lookupPredicates: SQL[] = [
        eq(schema.attendance.interestGroupId, input.interestGroupId),
        eq(schema.attendance.status, "active"),
    ];

    if (input.attendanceId) {
        lookupPredicates.push(eq(schema.attendance.id, input.attendanceId));
    } else if (input.clientCode) {
        lookupPredicates.push(
            eq(sql<string>`date(${schema.attendance.attendanceDate})`, attendanceDate),
        );
    } else {
        return {
            success: false,
            message: m.attendanceRecordNotFound(),
            reason: "not_found",
        };
    }

    if (input.clientCode) {
        lookupPredicates.push(eq(schema.attendance.clientCode, input.clientCode));
    }

    const [attendance] = await db
        .select({
            id: schema.attendance.id,
            chinese_name: attendanceParticipantDisplayNameExpression(
                sql<string>`${schema.attendance.clientCode}`,
            ),
            attended_at: schema.attendance.attendedAt,
        })
        .from(schema.attendance)
        .leftJoin(schema.clients, eq(schema.clients.id, schema.attendance.clientId))
        .leftJoin(schema.childMembers, eq(schema.childMembers.id, schema.attendance.childMemberId))
        .where(and(...lookupPredicates))
        .orderBy(desc(schema.attendance.id))
        .limit(1);

    if (!attendance) {
        return {
            success: false,
            message: m.attendanceRecordNotFound(),
            reason: "not_found",
        };
    }

    if (
        !isAttendanceUndoAllowed({
            attendedAt: attendance.attended_at,
            now: timestamp,
        })
    ) {
        return {
            success: false,
            message: m.attendanceUndoExpired(),
            reason: "undo_expired",
        };
    }

    await db
        .update(schema.attendance)
        .set({ status: "voided", updatedAt: timestamp })
        .where(eq(schema.attendance.id, attendance.id));

    return {
        success: true,
        message: m.attendanceCancelled({ name: attendance.chinese_name }),
    };
}

export async function getCoordinatorAttendanceRecords(
    db: AppDb,
): Promise<CoordinatorAttendanceRecord[]> {
    const attendanceDate = nowSqlDate();
    const rows = await db
        .select({
            id: schema.coordinatorAttendance.id,
            client_id: schema.coordinatorAttendance.clientId,
            child_member_id: schema.coordinatorAttendance.childMemberId,
            client_code: schema.coordinatorAttendance.clientCode,
            chinese_name: attendanceParticipantDisplayNameExpression(
                sql<string>`${schema.coordinatorAttendance.clientCode}`,
            ),
            english_name: attendanceParticipantEnglishNameExpression(),
            attended_at: schema.coordinatorAttendance.attendedAt,
            checked_out_at: schema.coordinatorAttendance.checkedOutAt,
            status: schema.coordinatorAttendance.status,
        })
        .from(schema.coordinatorAttendance)
        .leftJoin(
            schema.clients,
            eq(schema.clients.id, schema.coordinatorAttendance.clientId),
        )
        .leftJoin(
            schema.childMembers,
            eq(schema.childMembers.id, schema.coordinatorAttendance.childMemberId),
        )
        .where(
            and(
                eq(sql<string>`date(${schema.coordinatorAttendance.attendanceDate})`, attendanceDate),
                eq(schema.coordinatorAttendance.status, "active"),
            ),
        )
        .orderBy(
            desc(schema.coordinatorAttendance.attendedAt),
            desc(schema.coordinatorAttendance.id),
        );

    return rows.map((row) => ({
        id: row.id,
        clientId: row.client_id,
        childMemberId: row.child_member_id,
        clientCode: row.client_code,
        chineseName: row.chinese_name ?? row.client_code,
        englishName: row.english_name,
        attendedAt: row.attended_at,
        checkedOutAt: row.checked_out_at,
        status: row.status,
    }));
}

function coordinatorAttendanceParticipantKeyExpression(): SQL<string> {
    return sql<string>`CASE
        WHEN ${schema.coordinatorAttendance.clientId} IS NOT NULL THEN 'client:' || ${schema.coordinatorAttendance.clientId}
        WHEN ${schema.coordinatorAttendance.childMemberId} IS NOT NULL THEN 'child:' || ${schema.coordinatorAttendance.childMemberId}
        ELSE 'code:' || ${schema.coordinatorAttendance.clientCode}
    END`;
}

function coordinatorAttendanceNameExpression(): SQL<string> {
    return attendanceParticipantDisplayNameExpression(
        sql<string>`${schema.coordinatorAttendance.clientCode}`,
    );
}

function coordinatorAttendanceEnglishNameExpression(): SQL<string | null> {
    return attendanceParticipantEnglishNameExpression();
}

function coordinatorAttendanceParticipantCondition(participantKey: string | null): SQL | undefined {
    const cleanKey = cleanCoordinatorAttendanceParticipantKey(participantKey);
    if (!cleanKey) return undefined;
    const [kind, rawId] = cleanKey.split(":", 2);
    if (kind === "client") {
        const id = Number(rawId);
        return Number.isInteger(id) && id > 0
            ? eq(schema.coordinatorAttendance.clientId, id)
            : undefined;
    }
    if (kind === "child") {
        const id = Number(rawId);
        return Number.isInteger(id) && id > 0
            ? eq(schema.coordinatorAttendance.childMemberId, id)
            : undefined;
    }
    if (kind === "code") {
        return eq(schema.coordinatorAttendance.clientCode, rawId);
    }
    return undefined;
}

function coordinatorAttendanceDateRangeConditions(
    filters: Pick<CoordinatorAttendanceRecordsFilters, "dateFrom" | "dateTo">,
): SQL[] {
    const conditions: SQL[] = [
        eq(schema.coordinatorAttendance.status, "active"),
    ];
    if (filters.dateFrom) {
        conditions.push(
            gte(sql<string>`date(${schema.coordinatorAttendance.attendanceDate})`, filters.dateFrom),
        );
    }
    if (filters.dateTo) {
        conditions.push(
            lte(sql<string>`date(${schema.coordinatorAttendance.attendanceDate})`, filters.dateTo),
        );
    }
    return conditions;
}

function mapCoordinatorAttendanceParticipant(row: {
    participant_key: string;
    client_code: string;
    chinese_name: string | null;
    english_name: string | null;
}): CoordinatorAttendanceParticipantOption {
    const chineseName = row.chinese_name?.trim() || row.client_code;
    const englishName = row.english_name?.trim() || null;
    const secondaryName = englishName && englishName !== chineseName ? ` / ${englishName}` : "";
    const label = `${chineseName}${secondaryName} (${row.client_code})`;
    return {
        id: row.participant_key,
        value: row.participant_key,
        participantKey: row.participant_key,
        clientCode: row.client_code,
        title: label,
        label,
        chineseName,
        englishName,
        param_dict: {
            clientCode: row.client_code,
            chineseName,
            ...(englishName ? { englishName } : {}),
        },
    };
}

export async function listCoordinatorAttendanceRecordParticipants(
    db: AppDb,
    input: {
        search?: string;
        limit?: number;
    } = {},
): Promise<{
    options: CoordinatorAttendanceParticipantOption[];
    exactMatch: CoordinatorAttendanceParticipantOption | null;
}> {
    const searchText = input.search?.trim() ?? "";
    if (!searchText) {
        return { options: [], exactMatch: null };
    }

    const resolvedLimit = Math.min(Math.max(Math.trunc(input.limit ?? 8), 1), 50);
    const searchQuery = buildChineseNameSearchQuery(searchText);
    const participantSearchSql = searchQuery.likePatterns
        .map(
            () => `
                    participant_key LIKE ?
                    OR client_code LIKE ?
                    OR chinese_name LIKE ?
                    OR english_name LIKE ?
                    OR chinese_name_search_terms LIKE ? COLLATE NOCASE
            `,
        )
        .map((condition) => `(${condition})`)
        .join("\n                    OR ");
    const participantSearchParams = searchQuery.likePatterns.flatMap((searchLike) => [
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
    ]);
    const rows = await rawAll<{
        participant_key: string;
        client_code: string;
        chinese_name: string | null;
        english_name: string | null;
        exact_match: number;
    }>(db, {
        reasonKey: "domain.complex-directory-and-search",
        sql: `
            WITH active_records AS (
                SELECT
                    ca.id AS attendance_id,
                    CASE
                        WHEN ca.client_id IS NOT NULL THEN 'client:' || ca.client_id
                        WHEN ca.child_member_id IS NOT NULL THEN 'child:' || ca.child_member_id
                        ELSE 'code:' || ca.client_code
                    END AS participant_key,
                    ca.client_code,
                    CASE
                        WHEN c.id IS NOT NULL THEN COALESCE(
                            NULLIF(TRIM(c.chinese_name), ''),
                            NULLIF(TRIM(c.english_name), ''),
                            ca.client_code
                        )
                        WHEN cm.id IS NOT NULL THEN COALESCE(
                            NULLIF(TRIM(cm.chinese_name), ''),
                            NULLIF(TRIM(cm.english_name), ''),
                            ca.client_code
                        )
                        ELSE ca.client_code
                    END AS chinese_name,
                    COALESCE(c.english_name, cm.english_name) AS english_name,
                    COALESCE(c.chinese_name_search_terms, cm.chinese_name_search_terms, '') AS chinese_name_search_terms,
                    ca.attended_at
                FROM coordinator_attendance ca
                LEFT JOIN clients c ON c.id = ca.client_id
                LEFT JOIN child_members cm ON cm.id = ca.child_member_id
                WHERE ca.status = 'active'
            ),
            matched_keys AS (
                SELECT
                    participant_key,
                    MAX(
                        CASE
                            WHEN LOWER(participant_key) = LOWER(?) THEN 1
                            WHEN LOWER(client_code) = LOWER(?) THEN 1
                            ELSE 0
                        END
                    ) AS exact_match
                FROM active_records
                WHERE ${participantSearchSql || "0"}
                GROUP BY participant_key
            ),
            ranked_records AS (
                SELECT
                    active_records.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY active_records.participant_key
                        ORDER BY active_records.attended_at DESC, active_records.attendance_id DESC
                    ) AS rank
                FROM active_records
                INNER JOIN matched_keys
                    ON matched_keys.participant_key = active_records.participant_key
            )
            SELECT
                ranked_records.participant_key,
                ranked_records.client_code,
                ranked_records.chinese_name,
                ranked_records.english_name,
                matched_keys.exact_match
            FROM ranked_records
            INNER JOIN matched_keys
                ON matched_keys.participant_key = ranked_records.participant_key
            WHERE ranked_records.rank = 1
            ORDER BY ranked_records.attended_at DESC, ranked_records.attendance_id DESC
            LIMIT ?
        `,
        params: [
            searchText,
            searchText,
            ...participantSearchParams,
            resolvedLimit,
        ],
    });

    const options = rows.map(mapCoordinatorAttendanceParticipant);
    const exactMatch =
        options.find((option) =>
            rows.some((row) => row.participant_key === option.participantKey && row.exact_match)
        ) ?? null;

    return { options, exactMatch };
}

export async function getCoordinatorAttendanceRecordParticipant(
    db: AppDb,
    participantKey: string | null,
): Promise<CoordinatorAttendanceParticipantOption | null> {
    const condition = coordinatorAttendanceParticipantCondition(participantKey);
    if (!condition) return null;

    const participantKeyExpression = coordinatorAttendanceParticipantKeyExpression();
    const chineseName = coordinatorAttendanceNameExpression();
    const englishName = coordinatorAttendanceEnglishNameExpression();
    const [row] = await db
        .select({
            participant_key: participantKeyExpression,
            client_code: schema.coordinatorAttendance.clientCode,
            chinese_name: chineseName,
            english_name: englishName,
        })
        .from(schema.coordinatorAttendance)
        .leftJoin(
            schema.clients,
            eq(schema.clients.id, schema.coordinatorAttendance.clientId),
        )
        .leftJoin(
            schema.childMembers,
            eq(schema.childMembers.id, schema.coordinatorAttendance.childMemberId),
        )
        .where(and(eq(schema.coordinatorAttendance.status, "active"), condition))
        .orderBy(desc(schema.coordinatorAttendance.attendedAt), desc(schema.coordinatorAttendance.id))
        .limit(1);

    return row ? mapCoordinatorAttendanceParticipant(row) : null;
}

export async function getCoordinatorAttendanceRecordList(
    db: AppDb,
    filters: CoordinatorAttendanceRecordsFilters,
): Promise<CoordinatorAttendanceRecordsResult> {
    const participantCondition = coordinatorAttendanceParticipantCondition(filters.participantKey);
    const conditions = coordinatorAttendanceDateRangeConditions(filters);
    if (participantCondition) conditions.push(participantCondition);
    const where = and(...conditions);

    const [{ count = 0 } = { count: 0 }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.coordinatorAttendance)
        .where(where);

    const offset = (Math.max(filters.page, 1) - 1) * filters.limit;
    const participantKey = coordinatorAttendanceParticipantKeyExpression();
    const chineseName = coordinatorAttendanceNameExpression();
    const englishName = coordinatorAttendanceEnglishNameExpression();
    const rows = await db
        .select({
            id: schema.coordinatorAttendance.id,
            participant_key: participantKey,
            client_code: schema.coordinatorAttendance.clientCode,
            chinese_name: chineseName,
            english_name: englishName,
            attendance_date: schema.coordinatorAttendance.attendanceDate,
            attended_at: schema.coordinatorAttendance.attendedAt,
            checked_out_at: schema.coordinatorAttendance.checkedOutAt,
        })
        .from(schema.coordinatorAttendance)
        .leftJoin(
            schema.clients,
            eq(schema.clients.id, schema.coordinatorAttendance.clientId),
        )
        .leftJoin(
            schema.childMembers,
            eq(schema.childMembers.id, schema.coordinatorAttendance.childMemberId),
        )
        .where(where)
        .orderBy(
            desc(schema.coordinatorAttendance.attendanceDate),
            desc(schema.coordinatorAttendance.attendedAt),
            desc(schema.coordinatorAttendance.id),
        )
        .limit(filters.limit)
        .offset(offset);

    return {
        rows: rows.map((row) => ({
            id: row.id,
            participantKey: row.participant_key,
            clientCode: row.client_code,
            name: row.chinese_name?.trim() || row.english_name?.trim() || row.client_code,
            englishName: row.english_name,
            attendanceDate: row.attendance_date,
            attendedAt: row.attended_at,
            checkedOutAt: row.checked_out_at,
        })),
        total: Number(count ?? 0),
    };
}

function parseSqlLocalDateTime(value: string): number | null {
    return parseBusinessSqlDateTime(value);
}

export async function supplementCoordinatorAttendanceCheckOut(
    db: AppDb,
    input: {
        recordId: number;
        checkOutTime: string;
        now?: string;
    },
): Promise<{ success: boolean; message: string }> {
    const recordId = Math.trunc(input.recordId);
    if (!Number.isInteger(recordId) || recordId <= 0) {
        return { success: false, message: m.coordinatorAttendanceRecordNotFound() };
    }

    const checkOutTime = input.checkOutTime.trim();
    if (!isCoordinatorAttendanceCheckOutTime(checkOutTime)) {
        return { success: false, message: m.coordinatorAttendanceCheckOutTimeInvalid() };
    }

    const [record] = await db
        .select({
            id: schema.coordinatorAttendance.id,
            attendance_date: schema.coordinatorAttendance.attendanceDate,
            attended_at: schema.coordinatorAttendance.attendedAt,
            checked_out_at: schema.coordinatorAttendance.checkedOutAt,
        })
        .from(schema.coordinatorAttendance)
        .where(
            and(
                eq(schema.coordinatorAttendance.id, recordId),
                eq(schema.coordinatorAttendance.status, "active"),
            ),
        )
        .limit(1);

    if (!record) {
        return { success: false, message: m.coordinatorAttendanceRecordNotFound() };
    }
    if (record.checked_out_at) {
        return { success: false, message: m.coordinatorAttendanceCheckOutAlreadySet() };
    }

    const attendanceDate = record.attendance_date.slice(0, 10);
    const checkedOutAt = `${attendanceDate} ${checkOutTime}:00`;
    const checkedOutMs = parseSqlLocalDateTime(checkedOutAt);
    const attendedMs = parseSqlLocalDateTime(record.attended_at);
    if (checkedOutMs === null || attendedMs === null || checkedOutMs < attendedMs) {
        return { success: false, message: m.coordinatorAttendanceCheckOutBeforeCheckIn() };
    }

    const timestamp = input.now ?? nowSqlDateTime();
    if (attendanceDate === timestamp.slice(0, 10)) {
        const nowMs = parseSqlLocalDateTime(timestamp);
        if (nowMs !== null && checkedOutMs > nowMs) {
            return { success: false, message: m.coordinatorAttendanceCheckOutFuture() };
        }
    }

    const updateResult = await db
        .update(schema.coordinatorAttendance)
        .set({ checkedOutAt, updatedAt: timestamp })
        .where(
            and(
                eq(schema.coordinatorAttendance.id, record.id),
                eq(schema.coordinatorAttendance.status, "active"),
                isNull(schema.coordinatorAttendance.checkedOutAt),
            ),
        );

    if (!updateResult.meta.changes) {
        const [current] = await db
            .select({
                checked_out_at: schema.coordinatorAttendance.checkedOutAt,
                status: schema.coordinatorAttendance.status,
            })
            .from(schema.coordinatorAttendance)
            .where(eq(schema.coordinatorAttendance.id, record.id))
            .limit(1);
        if (current?.checked_out_at) {
            return { success: false, message: m.coordinatorAttendanceCheckOutAlreadySet() };
        }
        return { success: false, message: m.coordinatorAttendanceRecordNotFound() };
    }

    return {
        success: true,
        message: m.coordinatorAttendanceCheckOutSupplemented(),
    };
}

export async function getCoordinatorAttendanceCounters(db: AppDb): Promise<AttendanceCounters> {
    const attendanceDate = nowSqlDate();
    const [todayRow] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.coordinatorAttendance)
        .where(
            and(
                eq(sql<string>`date(${schema.coordinatorAttendance.attendanceDate})`, attendanceDate),
                eq(schema.coordinatorAttendance.status, "active"),
            ),
        );

    const monthPrefix = attendanceDate.slice(0, 7);
    const [monthRow] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.coordinatorAttendance)
        .where(
            and(
                like(
                    sql<string>`date(${schema.coordinatorAttendance.attendanceDate})`,
                    `${monthPrefix}%`,
                ),
                eq(schema.coordinatorAttendance.status, "active"),
            ),
        );

    return {
        todayTotal: Number(todayRow?.count ?? 0),
        monthTotal: Number(monthRow?.count ?? 0),
    };
}

export async function getCoordinatorAttendanceSnapshot(
    db: AppDb,
): Promise<CoordinatorAttendanceSnapshot> {
    const [records, counters] = await Promise.all([
        getCoordinatorAttendanceRecords(db),
        getCoordinatorAttendanceCounters(db),
    ]);

    return { records, counters };
}

export async function registerCoordinatorAttendance(
    db: AppDb,
    input: {
        clientCode: string;
        dataSource: string;
        forceRegisterAgain?: boolean;
        now?: string;
    },
): Promise<MemberAttendanceSessionRegisterResult> {
    const timestamp = input.now ?? nowSqlDateTime();
    const attendanceDate = timestamp.slice(0, 10) || nowSqlDate();
    const client = await getActiveParticipantByCode(db, input.clientCode);

    if (
        !client ||
        client.status !== "active" ||
        client.participant_type !== "client" ||
        client.client_type !== "Member"
    ) {
        return {
            checkResult: "Invalid",
            message: m.attendanceInvalidClient(),
        };
    }

    const [duplicate] = await db
        .select({
            id: schema.coordinatorAttendance.id,
            attended_at: schema.coordinatorAttendance.attendedAt,
            checked_out_at: schema.coordinatorAttendance.checkedOutAt,
        })
        .from(schema.coordinatorAttendance)
        .where(
            and(
                eq(sql<string>`date(${schema.coordinatorAttendance.attendanceDate})`, attendanceDate),
                eq(schema.coordinatorAttendance.clientCode, input.clientCode),
                eq(schema.coordinatorAttendance.status, "active"),
            ),
        )
        .orderBy(desc(schema.coordinatorAttendance.attendedAt), desc(schema.coordinatorAttendance.id))
        .limit(1);
    if (duplicate) {
        const duplicateResult = resolveSessionAttendanceDuplicateResult({
            duplicate,
            client,
            timestamp,
            forceRegisterAgain: input.forceRegisterAgain,
            checkoutConfirmationMessage: m.interestGroupCheckoutConfirmation(),
        });

        if (duplicateResult === "direct-checkout") {
            const result = await checkOutCoordinatorAttendance(db, {
                clientCode: input.clientCode,
                now: timestamp,
            });

            return {
                checkResult: result.success ? "Success" : "Invalid",
                message: result.message,
            };
        }

        if (duplicateResult) {
            return duplicateResult;
        }
    }

    const membershipCheckResult = await resolveAttendanceMembershipResult(db, client);
    if (membershipCheckResult === "Invalid") {
        return {
            checkResult: "Invalid",
            message: m.attendanceExpired(),
        };
    }

    await db.insert(schema.coordinatorAttendance).values({
        clientId: client.id,
        childMemberId: null,
        clientCode: input.clientCode,
        attendanceDate,
        dataSource: input.dataSource,
        attendedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        status: "active",
    });

    return buildSessionAttendanceSuccessResult(membershipCheckResult, client);
}

export async function checkOutCoordinatorAttendance(
    db: AppDb,
    input: {
        clientCode: string;
        now?: string;
    },
): Promise<{ success: boolean; message: string }> {
    const timestamp = input.now ?? nowSqlDateTime();
    const attendanceDate = timestamp.slice(0, 10) || nowSqlDate();
    const [attendance] = await db
        .select({
            id: schema.coordinatorAttendance.id,
            chinese_name: coordinatorAttendanceNameExpression(),
        })
        .from(schema.coordinatorAttendance)
        .leftJoin(
            schema.clients,
            eq(schema.clients.id, schema.coordinatorAttendance.clientId),
        )
        .leftJoin(
            schema.childMembers,
            eq(schema.childMembers.id, schema.coordinatorAttendance.childMemberId),
        )
        .where(
            and(
                eq(sql<string>`date(${schema.coordinatorAttendance.attendanceDate})`, attendanceDate),
                eq(schema.coordinatorAttendance.clientCode, input.clientCode),
                eq(schema.coordinatorAttendance.status, "active"),
                isNull(schema.coordinatorAttendance.checkedOutAt),
            ),
        )
        .orderBy(desc(schema.coordinatorAttendance.id))
        .limit(1);

    if (!attendance) {
        return {
            success: false,
            message: m.attendanceRecordNotFound(),
        };
    }

    await db
        .update(schema.coordinatorAttendance)
        .set({ checkedOutAt: timestamp, updatedAt: timestamp })
        .where(eq(schema.coordinatorAttendance.id, attendance.id));

    return {
        success: true,
        message: m.interestGroupCheckoutSuccess({ name: attendance.chinese_name }),
    };
}

export async function unregisterCoordinatorAttendance(
    db: AppDb,
    input: {
        clientCode: string;
    },
): Promise<{ success: boolean; message: string }> {
    const attendanceDate = nowSqlDate();
    const timestamp = nowSqlDateTime();
    const [attendance] = await db
        .select({
            id: schema.coordinatorAttendance.id,
            chinese_name: coordinatorAttendanceNameExpression(),
        })
        .from(schema.coordinatorAttendance)
        .leftJoin(
            schema.clients,
            eq(schema.clients.id, schema.coordinatorAttendance.clientId),
        )
        .leftJoin(
            schema.childMembers,
            eq(schema.childMembers.id, schema.coordinatorAttendance.childMemberId),
        )
        .where(
            and(
                eq(sql<string>`date(${schema.coordinatorAttendance.attendanceDate})`, attendanceDate),
                eq(schema.coordinatorAttendance.clientCode, input.clientCode),
                eq(schema.coordinatorAttendance.status, "active"),
            ),
        )
        .orderBy(desc(schema.coordinatorAttendance.id))
        .limit(1);

    if (!attendance) {
        return {
            success: false,
            message: m.attendanceRecordNotFound(),
        };
    }

    await db
        .update(schema.coordinatorAttendance)
        .set({ status: "voided", updatedAt: timestamp })
        .where(eq(schema.coordinatorAttendance.id, attendance.id));

    return {
        success: true,
        message: m.attendanceCancelled({ name: attendance.chinese_name }),
    };
}
