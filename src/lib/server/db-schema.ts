import { sql } from "drizzle-orm";
import {
    check,
    customType,
    index,
    integer,
    real,
    sqliteTable,
    text,
    unique,
    uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { SSO_ACCESS_STATUSES } from "../sso-access-status.ts";
import {
    EMPTY_ACTIVITY_QUESTIONNAIRE,
    EMPTY_ACTIVITY_REGISTRATION_ANSWERS,
    type ActivityQuestionnaire,
    type ActivityRegistrationAnswers,
} from "../activity-questionnaire.ts";
import { sqliteNormalizedFirstLastNameSql } from "./legal-name.ts";

export const MAX_ACTIVITY_EDIT_REVISION = Number.MAX_SAFE_INTEGER;

const constrainedText = customType<{
    data: string;
    config: { check: string };
    configRequired: true;
}>({
    dataType: ({ check: expression }) => `text CHECK (${expression})`,
});

const constrainedInteger = customType<{
    data: number;
    config: { check: string };
    configRequired: true;
}>({
    dataType: ({ check: expression }) => `integer CHECK (${expression})`,
});

export const users = sqliteTable(
    "app_users",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        ssoSubject: text("sso_subject").notNull().unique(),
        username: text("username").notNull(),
        displayName: text("display_name"),
        permissions: integer("permissions").notNull().default(0),
        status: text("status", { enum: ["active", "disabled"] })
            .notNull()
            .default("active"),
        ssoAccessStatus: text("sso_access_status", { enum: SSO_ACCESS_STATUSES })
            .notNull()
            .default("unknown"),
        ssoSyncedAt: text("sso_synced_at"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        check("app_users_permissions_check", sql`${table.permissions} BETWEEN 0 AND 7`),
        check("app_users_status_check", sql`${table.status} IN ('active', 'disabled')`),
        check(
            "app_users_sso_access_status_check",
            sql`${table.ssoAccessStatus} IN ('active', 'login_disabled', 'unknown_user', 'unknown')`,
        ),
        index("idx_app_users_sso_subject").on(table.ssoSubject),
        index("idx_app_users_status").on(table.status),
        index("idx_app_users_sso_access_status").on(table.ssoAccessStatus),
    ],
);

export const sessions = sqliteTable(
    "sessions",
    {
        id: text("id").primaryKey(),
        tokenHash: text("token_hash").notNull().unique(),
        userId: integer("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        expiresAt: integer("expires_at").notNull(),
        createdAt: text("created_at").notNull(),
        ssoCheckedAt: text("sso_checked_at"),
    },
    (table) => [
        index("idx_sessions_user_id").on(table.userId),
        index("idx_sessions_expires_at").on(table.expiresAt),
    ],
);

export const publicIdentitySessions = sqliteTable(
    "public_identity_sessions",
    {
        id: text("id").primaryKey(),
        tokenHash: text("token_hash").notNull().unique(),
        participantKind: text("participant_kind", {
            enum: ["client", "child_member", "temporary_participant"],
        }).notNull(),
        participantId: integer("participant_id").notNull(),
        participantCode: text("participant_code"),
        createdAt: text("created_at").notNull(),
        expiresAt: integer("expires_at").notNull(),
        revokedAt: text("revoked_at"),
    },
    (table) => [
        check(
            "public_identity_sessions_participant_kind_check",
            sql`${table.participantKind} IN ('client', 'child_member', 'temporary_participant')`,
        ),
        index("idx_public_identity_sessions_expires_at").on(table.expiresAt),
        index("idx_public_identity_sessions_participant").on(
            table.participantKind,
            table.participantId,
        ),
    ],
);

export const turnstileVerificationGrants = sqliteTable(
    "turnstile_verification_grants",
    {
        id: text("id").primaryKey(),
        identityHash: text("identity_hash").notNull().unique(),
        createdAt: text("created_at").notNull(),
        expiresAt: integer("expires_at").notNull(),
        usedAt: text("used_at"),
    },
    (table) => [index("idx_turnstile_verification_grants_expires_at").on(table.expiresAt)],
);

// Developer-maintained catalog. Frontend code must expose only canonical IDs 1 and 2.
export const projects = sqliteTable(
    "projects",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        name: text("name").notNull().unique(),
        status: text("status", { enum: ["active", "disabled"] })
            .notNull()
            .default("active"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        check("projects_status_check", sql`${table.status} IN ('active', 'disabled')`),
        index("idx_projects_status").on(table.status),
    ],
);

export const clients = sqliteTable(
    "clients",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        clientCode: text("client_code").notNull().unique(),
        clientType: text("client_type", { enum: ["Member"] }).notNull(),
        membershipType: text("membership_type", { enum: ["General", "Lifetime"] })
            .notNull()
            .default("General"),
        registrationDate: text("registration_date"),
        fsiiRegistrationDate: constrainedText("fsii_registration_date", {
            check: "fsii_registration_date IS NULL OR (length(fsii_registration_date) = 10 AND coalesce(strftime('%Y-%m-%d', fsii_registration_date) = fsii_registration_date, false))",
        }),
        firstName: text("first_name"),
        lastName: text("last_name"),
        legalNamePhotoIdVerified: integer("legal_name_photo_id_verified").notNull().default(0),
        englishName: text("english_name"),
        chineseName: text("chinese_name").notNull(),
        chineseNamePinyin: text("chinese_name_pinyin"),
        chineseNamePinyinCompact: text("chinese_name_pinyin_compact"),
        chineseNamePinyinInitials: text("chinese_name_pinyin_initials"),
        chineseNamePinyinGivenSurname: text("chinese_name_pinyin_given_surname"),
        chineseNameSearchTerms: text("chinese_name_search_terms"),
        gender: text("gender"),
        fsiiGenderDetail: constrainedText("fsii_gender_detail", {
            check: "fsii_gender_detail IS NULL OR (gender IS 'Other' AND fsii_gender_detail IN ('Transgender', 'Prefer not to disclose'))",
        }),
        otherGender: constrainedText("other_gender", {
            check: "other_gender IS NULL OR (gender IS 'Other' AND fsii_gender_detail IS NULL AND length(other_gender) <= 150)",
        }),
        dob: text("dob"),
        // "Age only" birth representation: a static age snapshot plus the
        // business date it was last confirmed. Mutually exclusive with dob at
        // the write-path level for clients (core table is never rebuilt).
        ageYears: constrainedInteger("age_years", {
            check: "age_years IS NULL OR (typeof(age_years) = 'integer' AND age_years BETWEEN 0 AND 120)",
        }),
        ageUpdatedDate: constrainedText("age_updated_date", {
            check: "age_updated_date IS NULL OR (length(age_updated_date) = 10 AND coalesce(strftime('%Y-%m-%d', age_updated_date) = age_updated_date, false))",
        }),
        cob: text("cob"),
        birthProvince: text("birth_province"),
        birthCity: text("birth_city"),
        residentialStatus: text("residential_status"),
        isVolunteer: integer("is_volunteer").notNull().default(0),
        address: text("address"),
        community: text("community"),
        postalCode: text("postal_code"),
        tel: text("tel"),
        email: text("email"),
        wechatId: text("wechat_id"),
        emergencyContactPerson: text("emergency_contact_person"),
        emergencyContactRelationship: text("emergency_contact_relationship"),
        emergencyContactTel: text("emergency_contact_tel"),
        referrerName: text("referrer_name"),
        directorName: text("director_name"),
        approverName: text("approver_name"),
        majorLanguage: text("major_language"),
        populationGroup: text("population_group"),
        maritalStatus: text("marital_status"),
        housingSituation: text("housing_situation"),
        primaryIncome: text("primary_income"),
        gradeInSchool: constrainedInteger("grade_in_school", {
            check: "grade_in_school IS NULL OR (typeof(grade_in_school) = 'integer' AND grade_in_school BETWEEN 1 AND 12)",
        }),
        numberChild: integer("number_child").notNull().default(0),
        numberAdult: integer("number_adult").notNull().default(0),
        highestGrade: text("highest_grade"),
        educationLevel: text("education_level"),
        indigenousIdentity: constrainedText("indigenous_identity", {
            check: "indigenous_identity IS NULL OR indigenous_identity IN ('Not applicable', 'First Nations (Status/Non-Status)', 'Métis', 'Inuk (Inuit)')",
        }),
        arrivalMonth: constrainedText("arrival_month", {
            check: "arrival_month IS NULL OR (length(arrival_month) = 4 AND arrival_month GLOB '[0-9][0-9][0-9][0-9]') OR (length(arrival_month) = 2 AND arrival_month GLOB '[0-9][0-9]' AND cast(arrival_month AS INTEGER) BETWEEN 1 AND 12) OR (length(arrival_month) = 7 AND coalesce(strftime('%Y-%m', arrival_month || '-01') = arrival_month, false))",
        }),
        physicalAccessibilityDifficulty: constrainedText("physical_accessibility_difficulty", {
            check: "physical_accessibility_difficulty IS NULL OR physical_accessibility_difficulty IN ('Yes, sometimes', 'Yes, often', 'No')",
        }),
        cognitiveDifficulty: constrainedText("cognitive_difficulty", {
            check: "cognitive_difficulty IS NULL OR cognitive_difficulty IN ('Yes, sometimes', 'Yes, often', 'No')",
        }),
        emotionalMentalHealthCondition: constrainedText("emotional_mental_health_condition", {
            check: "emotional_mental_health_condition IS NULL OR emotional_mental_health_condition IN ('Yes, sometimes', 'Yes, often', 'No')",
        }),
        remark: text("remark"),
        qrCodeKey: text("qr_code_key"),
        status: text("status", { enum: ["active", "disabled"] })
            .notNull()
            .default("active"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        check("clients_client_type_check", sql`${table.clientType} IN ('Member')`),
        check(
            "clients_membership_type_check",
            sql`${table.membershipType} IN ('General', 'Lifetime')`,
        ),
        check(
            "clients_gender_check",
            sql`${table.gender} IS NULL OR ${table.gender} IN ('Male', 'Female', 'Other')`,
        ),
        check("clients_status_check", sql`${table.status} IN ('active', 'disabled')`),
        index("idx_clients_client_code").on(table.clientCode),
        index("idx_clients_client_type").on(table.clientType),
        index("idx_clients_chinese_name").on(table.chineseName),
        index("idx_clients_chinese_name_pinyin").on(table.chineseNamePinyin),
        index("idx_clients_chinese_name_pinyin_compact").on(table.chineseNamePinyinCompact),
        index("idx_clients_chinese_name_pinyin_initials").on(table.chineseNamePinyinInitials),
        index("idx_clients_chinese_name_pinyin_given_surname").on(
            table.chineseNamePinyinGivenSurname,
        ),
    ],
);

export const childMembers = sqliteTable(
    "child_members",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        childCode: text("child_code").notNull().unique(),
        membershipType: text("membership_type", { enum: ["General", "Lifetime"] })
            .notNull()
            .default("General"),
        membershipExpiryDate: text("membership_expiry_date"),
        registrationDate: text("registration_date"),
        firstName: text("first_name"),
        lastName: text("last_name"),
        englishName: text("english_name"),
        chineseName: text("chinese_name").notNull(),
        chineseNamePinyin: text("chinese_name_pinyin"),
        chineseNamePinyinCompact: text("chinese_name_pinyin_compact"),
        chineseNamePinyinInitials: text("chinese_name_pinyin_initials"),
        chineseNamePinyinGivenSurname: text("chinese_name_pinyin_given_surname"),
        chineseNameSearchTerms: text("chinese_name_search_terms"),
        gender: text("gender"),
        dob: text("dob"),
        cob: text("cob"),
        residentialStatus: text("residential_status"),
        yearOfArrival: integer("year_of_arrival"),
        community: text("community"),
        postalCode: text("postal_code"),
        tel: text("tel"),
        email: text("email"),
        wechatId: text("wechat_id"),
        emergencyContactPerson: text("emergency_contact_person"),
        emergencyContactTel: text("emergency_contact_tel"),
        parentType: text("parent_type", { enum: ["member", "non_member"] })
            .notNull()
            .default("non_member"),
        parentClientId: integer("parent_client_id").references(() => clients.id, {
            onDelete: "set null",
        }),
        parentTemporaryParticipantId: integer("parent_temporary_participant_id").references(
            () => temporaryParticipants.id,
            { onDelete: "set null" },
        ),
        parentName: text("parent_name"),
        parentContact: text("parent_contact"),
        majorLanguage: text("major_language"),
        populationGroup: text("population_group"),
        maritalStatus: text("marital_status"),
        housingSituation: text("housing_situation"),
        primaryIncome: text("primary_income"),
        numberChild: integer("number_child").notNull().default(0),
        numberAdult: integer("number_adult").notNull().default(0),
        highestGrade: text("highest_grade"),
        educationLevel: text("education_level"),
        accessibilityQ1: text("accessibility_q1"),
        accessibilityQ2: text("accessibility_q2"),
        accessibilityQ3: text("accessibility_q3"),
        remark: text("remark"),
        status: text("status", { enum: ["active", "disabled"] })
            .notNull()
            .default("active"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        check(
            "child_members_membership_type_check",
            sql`${table.membershipType} IN ('General', 'Lifetime')`,
        ),
        check(
            "child_members_gender_check",
            sql`${table.gender} IS NULL OR ${table.gender} IN ('Male', 'Female', 'Other')`,
        ),
        check(
            "child_members_parent_type_check",
            sql`${table.parentType} IN ('member', 'non_member')`,
        ),
        check(
            "child_members_parent_identity_check",
            sql`(${table.parentClientId} IS NULL OR (${table.parentType} = 'member' AND ${table.parentTemporaryParticipantId} IS NULL)) AND (${table.parentTemporaryParticipantId} IS NULL OR (${table.parentType} = 'non_member' AND ${table.parentClientId} IS NULL))`,
        ),
        check("child_members_status_check", sql`${table.status} IN ('active', 'disabled')`),
        index("idx_child_members_child_code").on(table.childCode),
        index("idx_child_members_parent_client_id").on(table.parentClientId),
        index("idx_child_members_parent_temporary_participant_id").on(
            table.parentTemporaryParticipantId,
        ),
        index("idx_child_members_chinese_name").on(table.chineseName),
        index("idx_child_members_chinese_name_pinyin").on(table.chineseNamePinyin),
        index("idx_child_members_chinese_name_pinyin_compact").on(
            table.chineseNamePinyinCompact,
        ),
        index("idx_child_members_chinese_name_pinyin_initials").on(
            table.chineseNamePinyinInitials,
        ),
        index("idx_child_members_chinese_name_pinyin_given_surname").on(
            table.chineseNamePinyinGivenSurname,
        ),
    ],
);

export const organizations = sqliteTable(
    "organizations",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        organizationCode: text("organization_code").notNull().unique(),
        registrationDate: text("registration_date"),
        englishName: text("english_name").notNull(),
        chineseName: text("chinese_name").notNull(),
        chineseNamePinyin: text("chinese_name_pinyin"),
        chineseNamePinyinCompact: text("chinese_name_pinyin_compact"),
        chineseNamePinyinInitials: text("chinese_name_pinyin_initials"),
        chineseNamePinyinGivenSurname: text("chinese_name_pinyin_given_surname"),
        chineseNameSearchTerms: text("chinese_name_search_terms"),
        community: text("community"),
        postalCode: text("postal_code"),
        tel: text("tel"),
        email: text("email"),
        wechatId: text("wechat_id"),
        website: text("website"),
        remark: text("remark"),
        status: text("status", { enum: ["active", "disabled"] })
            .notNull()
            .default("active"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        check("organizations_status_check", sql`${table.status} IN ('active', 'disabled')`),
        index("idx_organizations_organization_code").on(table.organizationCode),
        index("idx_organizations_chinese_name").on(table.chineseName),
        index("idx_organizations_chinese_name_pinyin").on(table.chineseNamePinyin),
        index("idx_organizations_chinese_name_pinyin_compact").on(
            table.chineseNamePinyinCompact,
        ),
        index("idx_organizations_chinese_name_pinyin_initials").on(
            table.chineseNamePinyinInitials,
        ),
        index("idx_organizations_chinese_name_pinyin_given_surname").on(
            table.chineseNamePinyinGivenSurname,
        ),
    ],
);

export const organizationContacts = sqliteTable(
    "organization_contacts",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        organizationId: integer("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        chineseName: text("chinese_name").notNull(),
        chineseNameSearchTerms: text("chinese_name_search_terms"),
        englishName: text("english_name").notNull(),
        tel: text("tel"),
        email: text("email"),
        wechatId: text("wechat_id"),
        sortOrder: integer("sort_order").notNull().default(0),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [index("idx_organization_contacts_organization_id").on(table.organizationId)],
);

export const receiptAssets = sqliteTable("receipt_assets", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    r2Key: text("r2_key").notNull().unique(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    createdAt: text("created_at").notNull(),
});

export const receipts = sqliteTable(
    "receipts",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        receiptNo: text("receipt_no").notNull().unique(),
        payerClientId: integer("payer_client_id").references(() => clients.id, {
            onDelete: "set null",
        }),
        payerChildMemberId: integer("payer_child_member_id").references(() => childMembers.id, {
            onDelete: "set null",
        }),
        payerOrganizationId: integer("payer_organization_id").references(() => organizations.id, {
            onDelete: "set null",
        }),
        attachmentAssetId: integer("attachment_asset_id").references(() => receiptAssets.id, {
            onDelete: "set null",
        }),
        issueDate: text("issue_date").notNull(),
        membershipYear: integer("membership_year"),
        currency: text("currency").notNull().default("CAD"),
        amount: real("amount").notNull().default(0),
        paymentType: text("payment_type").notNull(),
        paymentMethod: text("payment_method").notNull(),
        designatedPersonId: integer("designated_person_id").references(() => users.id, {
            onDelete: "set null",
        }),
        remark: text("remark"),
        status: text("status", { enum: ["active", "voided"] }).notNull().default("active"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        check("receipts_status_check", sql`${table.status} IN ('active', 'voided')`),
        check(
            "receipts_single_payer_check",
            sql`(${table.payerClientId} IS NULL OR ${table.payerChildMemberId} IS NULL) AND (${table.payerClientId} IS NULL OR ${table.payerOrganizationId} IS NULL) AND (${table.payerChildMemberId} IS NULL OR ${table.payerOrganizationId} IS NULL)`,
        ),
        index("idx_receipts_payer_client_id").on(table.payerClientId),
        index("idx_receipts_payer_child_member_id").on(table.payerChildMemberId),
        index("idx_receipts_payer_organization_id").on(table.payerOrganizationId),
        index("idx_receipts_designated_person_id").on(table.designatedPersonId),
        index("idx_receipts_issue_date").on(table.issueDate),
        index("idx_receipts_payment_type").on(table.paymentType),
        index("idx_receipts_payer_client_membership_year").on(
            table.payerClientId,
            table.paymentType,
            table.status,
            table.membershipYear,
        ),
        index("idx_receipts_payer_child_membership_year").on(
            table.payerChildMemberId,
            table.paymentType,
            table.status,
            table.membershipYear,
        ),
    ],
);

export const receiptAttachments = sqliteTable(
    "receipt_attachments",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        receiptId: integer("receipt_id")
            .notNull()
            .references(() => receipts.id, { onDelete: "cascade" }),
        assetId: integer("asset_id")
            .notNull()
            .references(() => receiptAssets.id, { onDelete: "cascade" }),
        sortOrder: integer("sort_order").notNull().default(0),
        createdAt: text("created_at").notNull(),
    },
    (table) => [
        unique("receipt_attachments_receipt_asset_unique").on(table.receiptId, table.assetId),
        index("idx_receipt_attachments_receipt_order").on(table.receiptId, table.sortOrder),
        index("idx_receipt_attachments_asset_id").on(table.assetId),
    ],
);

export const receiptAssetCleanupQueue = sqliteTable("receipt_asset_cleanup_queue", {
    assetId: integer("asset_id").primaryKey(),
    r2Key: text("r2_key").notNull(),
    status: text("status", { enum: ["pending", "claimed"] }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAtMs: integer("next_attempt_at_ms").notNull().default(0),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
});

export const receiptEditLocks = sqliteTable(
    "receipt_edit_locks",
    {
        receiptId: integer("receipt_id")
            .primaryKey()
            .references(() => receipts.id, { onDelete: "cascade" }),
        lockToken: text("lock_token").notNull().unique(),
        userId: integer("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        acquiredAtMs: integer("acquired_at_ms").notNull(),
        lastActivityAtMs: integer("last_activity_at_ms").notNull(),
        expiresAtMs: integer("expires_at_ms").notNull(),
    },
    (table) => [
        index("idx_receipt_edit_locks_expires_at").on(table.expiresAtMs),
        index("idx_receipt_edit_locks_user_id").on(table.userId),
    ],
);

export const receiptAttachmentStaging = sqliteTable(
    "receipt_attachment_staging",
    {
        id: text("id").primaryKey(),
        assetId: integer("asset_id")
            .notNull()
            .unique()
            .references(() => receiptAssets.id, { onDelete: "cascade" }),
        userId: integer("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        formSessionId: text("form_session_id").notNull(),
        receiptId: integer("receipt_id").references(() => receipts.id, { onDelete: "cascade" }),
        createdAtMs: integer("created_at_ms").notNull(),
        expiresAtMs: integer("expires_at_ms").notNull(),
    },
    (table) => [
        index("idx_receipt_attachment_staging_owner").on(
            table.userId,
            table.formSessionId,
        ),
        index("idx_receipt_attachment_staging_expires_at").on(table.expiresAtMs),
    ],
);

export const scannerLocks = sqliteTable("scanner_locks", {
    deviceKey: text("device_key").primaryKey(),
    sessionId: text("session_id").notNull().unique(),
    userId: integer("user_id").notNull(),
    startedAtMs: integer("started_at_ms").notNull(),
    expiresAtMs: integer("expires_at_ms").notNull(),
    messageId: text("message_id"),
    attachmentId: text("attachment_id"),
    fileName: text("file_name"),
    receivedAt: text("received_at"),
});

export const activityAssets = sqliteTable("activity_assets", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    r2Key: text("r2_key").notNull().unique(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type"),
    createdAt: text("created_at").notNull(),
});

export const activityAssetCleanupQueue = sqliteTable(
    "activity_asset_cleanup_queue",
    {
        assetId: integer("asset_id")
            .primaryKey()
            .references(() => activityAssets.id, { onDelete: "cascade" }),
        r2Key: text("r2_key").notNull(),
        status: text("status", { enum: ["uploading", "pending", "claimed"] })
            .notNull()
            .default("uploading"),
        leaseToken: text("lease_token"),
        leaseExpiresAtMs: integer("lease_expires_at_ms").notNull(),
        attempts: integer("attempts").notNull().default(0),
        nextAttemptAtMs: integer("next_attempt_at_ms").notNull().default(0),
        lastError: text("last_error"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        check(
            "activity_asset_cleanup_queue_status_check",
            sql`${table.status} IN ('uploading', 'pending', 'claimed')`,
        ),
        index("idx_activity_asset_cleanup_queue_eligibility").on(
            table.status,
            table.nextAttemptAtMs,
            table.leaseExpiresAtMs,
        ),
    ],
);

export const temporaryParticipants = sqliteTable(
    "temporary_participants",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        fsiiRegistrationDate: constrainedText("fsii_registration_date", {
            check: "fsii_registration_date IS NULL OR (length(fsii_registration_date) = 10 AND coalesce(strftime('%Y-%m-%d', fsii_registration_date) = fsii_registration_date, false))",
        }),
        firstName: text("first_name").notNull(),
        lastName: text("last_name").notNull(),
        legalNamePhotoIdVerified: integer("legal_name_photo_id_verified").notNull().default(0),
        englishName: text("english_name"),
        chineseName: text("chinese_name"),
        chineseNamePinyin: text("chinese_name_pinyin"),
        chineseNamePinyinCompact: text("chinese_name_pinyin_compact"),
        chineseNamePinyinInitials: text("chinese_name_pinyin_initials"),
        chineseNamePinyinGivenSurname: text("chinese_name_pinyin_given_surname"),
        chineseNameSearchTerms: text("chinese_name_search_terms"),
        gender: text("gender", { enum: ["Male", "Female", "Other"] }),
        fsiiGenderDetail: constrainedText("fsii_gender_detail", {
            check: "fsii_gender_detail IS NULL OR (gender IS 'Other' AND fsii_gender_detail IN ('Transgender', 'Prefer not to disclose'))",
        }),
        otherGender: constrainedText("other_gender", {
            check: "other_gender IS NULL OR (gender IS 'Other' AND fsii_gender_detail IS NULL AND length(other_gender) <= 150)",
        }),
        dob: text("dob"),
        ageYears: constrainedInteger("age_years", {
            check: "age_years IS NULL OR (typeof(age_years) = 'integer' AND age_years BETWEEN 0 AND 120)",
        }),
        ageUpdatedDate: constrainedText("age_updated_date", {
            check: "age_updated_date IS NULL OR (length(age_updated_date) = 10 AND coalesce(strftime('%Y-%m-%d', age_updated_date) = age_updated_date, false))",
        }),
        cob: text("cob"),
        birthProvince: text("birth_province"),
        birthCity: text("birth_city"),
        residentialStatus: text("residential_status"),
        isVolunteer: integer("is_volunteer").notNull().default(0),
        address: text("address"),
        community: text("community"),
        postalCode: text("postal_code"),
        tel: text("tel").notNull(),
        email: text("email").notNull(),
        wechatId: text("wechat_id"),
        emergencyContactPerson: text("emergency_contact_person"),
        emergencyContactRelationship: text("emergency_contact_relationship"),
        emergencyContactTel: text("emergency_contact_tel"),
        majorLanguage: text("major_language"),
        populationGroup: text("population_group"),
        maritalStatus: text("marital_status"),
        housingSituation: text("housing_situation"),
        primaryIncome: text("primary_income"),
        gradeInSchool: constrainedInteger("grade_in_school", {
            check: "grade_in_school IS NULL OR (typeof(grade_in_school) = 'integer' AND grade_in_school BETWEEN 1 AND 12)",
        }),
        numberChild: integer("number_child").notNull().default(0),
        numberAdult: integer("number_adult").notNull().default(0),
        highestGrade: text("highest_grade"),
        educationLevel: text("education_level"),
        indigenousIdentity: constrainedText("indigenous_identity", {
            check: "indigenous_identity IS NULL OR indigenous_identity IN ('Not applicable', 'First Nations (Status/Non-Status)', 'Métis', 'Inuk (Inuit)')",
        }),
        arrivalMonth: constrainedText("arrival_month", {
            check: "arrival_month IS NULL OR (length(arrival_month) = 4 AND arrival_month GLOB '[0-9][0-9][0-9][0-9]') OR (length(arrival_month) = 2 AND arrival_month GLOB '[0-9][0-9]' AND cast(arrival_month AS INTEGER) BETWEEN 1 AND 12) OR (length(arrival_month) = 7 AND coalesce(strftime('%Y-%m', arrival_month || '-01') = arrival_month, false))",
        }),
        physicalAccessibilityDifficulty: constrainedText("physical_accessibility_difficulty", {
            check: "physical_accessibility_difficulty IS NULL OR physical_accessibility_difficulty IN ('Yes, sometimes', 'Yes, often', 'No')",
        }),
        cognitiveDifficulty: constrainedText("cognitive_difficulty", {
            check: "cognitive_difficulty IS NULL OR cognitive_difficulty IN ('Yes, sometimes', 'Yes, often', 'No')",
        }),
        emotionalMentalHealthCondition: constrainedText("emotional_mental_health_condition", {
            check: "emotional_mental_health_condition IS NULL OR emotional_mental_health_condition IN ('Yes, sometimes', 'Yes, often', 'No')",
        }),
        remark: text("remark"),
        convertedClientId: integer("converted_client_id").references(() => clients.id, {
            onDelete: "restrict",
        }),
        convertedAt: constrainedText("converted_at", {
            check: "(converted_at IS NULL AND converted_client_id IS NULL) OR (converted_at IS NOT NULL AND converted_client_id IS NOT NULL AND status = 'disabled' AND length(converted_at) = 19 AND coalesce(strftime('%Y-%m-%d %H:%M:%S', converted_at) = converted_at, false))",
        }),
        status: text("status", { enum: ["active", "disabled"] })
            .notNull()
            .default("active"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        check(
            "temporary_participants_gender_check",
            sql`${table.gender} IS NULL OR ${table.gender} IN ('Male', 'Female', 'Other')`,
        ),
        check(
            "temporary_participants_dob_check",
            sql`${table.dob} IS NULL OR (${table.dob} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(${table.dob}, '+0 days') IS NOT NULL AND date(${table.dob}, '+0 days') = ${table.dob} AND ${table.dob} >= '1900-01-01')`,
        ),
        check(
            "temporary_participants_dob_age_exclusive_check",
            sql`NOT (${table.dob} IS NOT NULL AND ${table.ageYears} IS NOT NULL)`,
        ),
        check(
            "temporary_participants_age_pair_check",
            sql`(${table.ageYears} IS NULL) = (${table.ageUpdatedDate} IS NULL)`,
        ),
        check(
            "temporary_participants_status_check",
            sql`${table.status} IN ('active', 'disabled')`,
        ),
        index("idx_temporary_participants_chinese_name_pinyin").on(table.chineseNamePinyin),
        index("idx_temporary_participants_chinese_name_pinyin_compact").on(table.chineseNamePinyinCompact),
        index("idx_temporary_participants_chinese_name_pinyin_initials").on(table.chineseNamePinyinInitials),
        index("idx_temporary_participants_chinese_name_pinyin_given_surname").on(table.chineseNamePinyinGivenSurname),
        uniqueIndex("temporary_participants_name_dob_unique").on(
            sqliteNormalizedFirstLastNameSql(table.firstName, table.lastName),
            table.dob,
        ),
        index("idx_temporary_participants_status").on(table.status),
        uniqueIndex("temporary_participants_converted_client_unique")
            .on(table.convertedClientId)
            .where(sql`${table.convertedClientId} IS NOT NULL`),
    ],
);

export const fsiiSurveyResponses = sqliteTable(
    "fsii_survey_responses",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        clientId: integer("client_id").references(() => clients.id, { onDelete: "restrict" }),
        temporaryParticipantId: integer("temporary_participant_id").references(
            () => temporaryParticipants.id,
            { onDelete: "restrict" },
        ),
        surveyType: text("survey_type", {
            enum: ["community_participation", "satisfaction"],
        }).notNull(),
        answeredDate: text("answered_date").notNull(),
        uploadedDate: text("uploaded_date"),
        // uploaded_date stores the FSII-side answered (test) date read back from
        // the upload log; fsii_submission_date stores the FSII submission date.
        fsiiSubmissionDate: text("fsii_submission_date"),
        questionnaireVersion: text("questionnaire_version").notNull(),
        answer1: text("answer_1"),
        answer2: text("answer_2"),
        answer3: text("answer_3"),
        answer4: text("answer_4"),
        answer5: text("answer_5"),
        answer6: text("answer_6"),
        answer7: text("answer_7"),
        createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
        createdAt: text("created_at").notNull(),
    },
    (table) => [
        check(
            "fsii_survey_responses_single_participant_check",
            sql`(${table.clientId} IS NOT NULL AND ${table.temporaryParticipantId} IS NULL) OR (${table.clientId} IS NULL AND ${table.temporaryParticipantId} IS NOT NULL)`,
        ),
        check(
            "fsii_survey_responses_type_check",
            sql`${table.surveyType} IN ('community_participation', 'satisfaction')`,
        ),
        check(
            "fsii_survey_responses_date_check",
            sql`${table.answeredDate} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(${table.answeredDate}, '+0 days') IS NOT NULL AND date(${table.answeredDate}, '+0 days') = ${table.answeredDate}`,
        ),
        check(
            "fsii_survey_responses_answers_check",
            sql`(${table.answer1} IN ('Never, or almost never', 'Rarely', 'Occasionally', 'Quite often', 'Very often', 'Always, or almost always') AND ${table.answer2} IN ('Never, or almost never', 'Rarely', 'Occasionally', 'Quite often', 'Very often', 'Always, or almost always') AND ${table.answer3} IS NOT NULL AND ${table.answer4} IS NOT NULL AND ${table.answer5} IS NOT NULL) OR (${table.answer6} IN ('Strongly disagree', 'Disagree', 'Neither', 'Agree', 'Strongly agree', 'N/A') AND ${table.answer7} IN ('Strongly disagree', 'Disagree', 'Neither', 'Agree', 'Strongly agree', 'N/A') AND ${table.answer1} IS NULL AND ${table.answer2} IS NULL AND ${table.answer3} IS NULL AND ${table.answer4} IS NULL AND ${table.answer5} IS NULL) OR (${table.answer1} IS NOT NULL AND ${table.answer2} IS NOT NULL AND ${table.answer3} IS NOT NULL AND ${table.answer4} IS NOT NULL AND ${table.answer5} IS NOT NULL AND ${table.answer6} IN ('Strongly disagree', 'Disagree', 'Neither', 'Agree', 'Strongly agree', 'N/A') AND ${table.answer7} IN ('Strongly disagree', 'Disagree', 'Neither', 'Agree', 'Strongly agree', 'N/A'))`,
        ),
        uniqueIndex("fsii_survey_responses_client_unique").on(
            table.clientId,
            table.answeredDate,
        ).where(sql`${table.clientId} IS NOT NULL`),
        uniqueIndex("fsii_survey_responses_temporary_unique").on(
            table.temporaryParticipantId,
            table.answeredDate,
        ).where(sql`${table.temporaryParticipantId} IS NOT NULL`),
        index("idx_fsii_survey_responses_client_date").on(table.clientId, table.answeredDate),
        index("idx_fsii_survey_responses_temporary_date").on(
            table.temporaryParticipantId,
            table.answeredDate,
        ),
        index("idx_fsii_survey_responses_type_date").on(table.surveyType, table.answeredDate),
    ],
);

export const activities = sqliteTable(
    "activities",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        name: text("name").notNull(),
        description: text("description"),
        projectId: integer("project_id").references(() => projects.id, {
            onDelete: "set null",
        }),
        imageAssetId: integer("image_asset_id").references(() => activityAssets.id, {
            onDelete: "set null",
        }),
        heldAt: text("held_at"),
        expectedParticipants: integer("expected_participants").notNull().default(10),
        waitlistPercentage: integer("waitlist_percentage").notNull().default(10),
        questions: text("questions", { mode: "json" })
            .$type<ActivityQuestionnaire>()
            .notNull()
            .default(EMPTY_ACTIVITY_QUESTIONNAIRE),
        status: text("status", { enum: ["active", "disabled"] })
            .notNull()
            .default("active"),
        requireRegistrationForCheckIn: integer("require_registration_for_check_in", {
            mode: "boolean",
        }).notNull().default(true),
        integrityEnabled: integer("integrity_enabled", {
            mode: "boolean",
        }).notNull().default(false),
        editRevision: integer("edit_revision").notNull().default(1),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        check("activities_status_check", sql`${table.status} IN ('active', 'disabled')`),
        check(
            "activities_edit_revision_check",
            sql`typeof(${table.editRevision}) = 'integer' AND ${table.editRevision} > 0 AND ${table.editRevision} <= ${sql.raw(String(MAX_ACTIVITY_EDIT_REVISION))}`,
        ),
        check(
            "activities_expected_participants_check",
            sql`typeof(${table.expectedParticipants}) = 'integer' AND ${table.expectedParticipants} >= 0`,
        ),
        check(
            "activities_waitlist_percentage_check",
            sql`typeof(${table.waitlistPercentage}) = 'integer' AND ${table.waitlistPercentage} BETWEEN 1 AND 100`,
        ),
        check(
            "activities_questions_json_check",
            sql`json_valid(${table.questions}) AND json_type(${table.questions}) = 'object'`,
        ),
        index("idx_activities_project_id").on(table.projectId),
        index("idx_activities_status_held_at").on(table.status, table.heldAt),
        index("idx_activities_name").on(table.name),
    ],
);

export const activityRegistrations = sqliteTable(
    "activity_registrations",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        activityId: integer("activity_id")
            .notNull()
            .references(() => activities.id, { onDelete: "cascade" }),
        clientId: integer("client_id")
            .references(() => clients.id, { onDelete: "cascade" }),
        childMemberId: integer("child_member_id").references(() => childMembers.id, {
            onDelete: "cascade",
        }),
        temporaryParticipantId: integer("temporary_participant_id").references(
            () => temporaryParticipants.id,
            { onDelete: "restrict" },
        ),
        clientCode: text("client_code").notNull(),
        registrationStatus: text("registration_status", {
            enum: ["active", "waitlisted", "cancelled"],
        })
            .notNull()
            .default("active"),
        registeredAt: text("registered_at"),
        waitlistedAt: text("waitlisted_at"),
        registrationUpdatedAt: text("registration_updated_at"),
        integrityLateCancelledAt: text("integrity_late_cancelled_at"),
        answers: text("answers", { mode: "json" })
            .$type<ActivityRegistrationAnswers>()
            .notNull()
            .default(EMPTY_ACTIVITY_REGISTRATION_ANSWERS),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        check(
            "activity_registrations_status_check",
            sql`${table.registrationStatus} IN ('active', 'waitlisted', 'cancelled')`,
        ),
        check(
            "activity_registrations_single_participant_check",
            sql`(${table.clientId} IS NOT NULL AND ${table.childMemberId} IS NULL AND ${table.temporaryParticipantId} IS NULL) OR (${table.clientId} IS NULL AND ${table.childMemberId} IS NOT NULL AND ${table.temporaryParticipantId} IS NULL) OR (${table.clientId} IS NULL AND ${table.childMemberId} IS NULL AND ${table.temporaryParticipantId} IS NOT NULL)`,
        ),
        check(
            "activity_registrations_answers_json_check",
            sql`json_valid(${table.answers}) AND json_type(${table.answers}) = 'object'`,
        ),
        index("idx_activity_registrations_activity_status").on(
            table.activityId,
            table.registrationStatus,
        ),
        index("idx_activity_registrations_client_code").on(table.clientCode),
        index("idx_activity_registrations_temporary_participant_id").on(
            table.temporaryParticipantId,
        ),
        unique("activity_registrations_activity_id_client_code_unique").on(
            table.activityId,
            table.clientCode,
        ),
    ],
);

export const activityAiQuestionCache = sqliteTable(
    "activity_ai_question_cache",
    {
        cacheKey: text("cache_key").primaryKey(),
        activityId: integer("activity_id")
            .notNull()
            .references(() => activities.id, { onDelete: "cascade" }),
        questionId: text("question_id").notNull(),
        currentAnswer: text("current_answer").notNull(),
        otherAnswers: text("other_answers", { mode: "json" }).$type<string[]>().notNull(),
        data: text("data", { mode: "json" }).$type<string[]>().notNull(),
        expiresAt: integer("expires_at").notNull(),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        check("activity_ai_question_cache_other_answers_json_check", sql`json_valid(${table.otherAnswers}) AND json_type(${table.otherAnswers}) = 'array'`),
        check("activity_ai_question_cache_data_json_check", sql`json_valid(${table.data}) AND json_type(${table.data}) = 'array'`),
        index("idx_activity_ai_question_cache_activity_question").on(table.activityId, table.questionId),
        index("idx_activity_ai_question_cache_expires_at").on(table.expiresAt),
    ],
);

export const activityAttendance = sqliteTable(
    "activity_attendance",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        activityId: integer("activity_id")
            .notNull()
            .references(() => activities.id, { onDelete: "cascade" }),
        clientId: integer("client_id")
            .references(() => clients.id, { onDelete: "cascade" }),
        childMemberId: integer("child_member_id").references(() => childMembers.id, {
            onDelete: "cascade",
        }),
        temporaryParticipantId: integer("temporary_participant_id").references(
            () => temporaryParticipants.id,
            { onDelete: "restrict" },
        ),
        clientCode: text("client_code").notNull(),
        attendanceStatus: text("attendance_status", { enum: ["active", "voided"] })
            .notNull()
            .default("active"),
        attendedAt: text("attended_at"),
        attendanceSource: text("attendance_source"),
        wasRegisteredWhenAttended: integer("was_registered_when_attended")
            .notNull()
            .default(0),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        check(
            "activity_attendance_status_check",
            sql`${table.attendanceStatus} IN ('active', 'voided')`,
        ),
        check(
            "activity_attendance_single_participant_check",
            sql`(${table.clientId} IS NOT NULL AND ${table.childMemberId} IS NULL AND ${table.temporaryParticipantId} IS NULL) OR (${table.clientId} IS NULL AND ${table.childMemberId} IS NOT NULL AND ${table.temporaryParticipantId} IS NULL) OR (${table.clientId} IS NULL AND ${table.childMemberId} IS NULL AND ${table.temporaryParticipantId} IS NOT NULL)`,
        ),
        check(
            "activity_attendance_was_registered_check",
            sql`${table.wasRegisteredWhenAttended} IN (0, 1)`,
        ),
        index("idx_activity_attendance_activity_status").on(
            table.activityId,
            table.attendanceStatus,
        ),
        index("idx_activity_attendance_client_code").on(table.clientCode),
        index("idx_activity_attendance_temporary_participant_id").on(
            table.temporaryParticipantId,
        ),
        unique("activity_attendance_activity_id_client_code_unique").on(
            table.activityId,
            table.clientCode,
        ),
    ],
);

export const interestGroups = sqliteTable(
    "interest_groups",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        name: text("name").notNull().unique(),
        defaultAttendanceDate: text("default_attendance_date"),
        status: text("status", { enum: ["active", "disabled"] })
            .notNull()
            .default("active"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        check("interest_groups_status_check", sql`${table.status} IN ('active', 'disabled')`),
        index("idx_interest_groups_name").on(table.name),
    ],
);

export const attendance = sqliteTable(
    "attendance",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        interestGroupId: integer("interest_group_id")
            .notNull()
            .references(() => interestGroups.id, { onDelete: "cascade" }),
        interestGroupName: text("interest_group_name"),
        clientId: integer("client_id")
            .references(() => clients.id, { onDelete: "cascade" }),
        childMemberId: integer("child_member_id").references(() => childMembers.id, {
            onDelete: "cascade",
        }),
        clientCode: text("client_code").notNull(),
        attendanceDate: text("attendance_date").notNull(),
        dataSource: text("data_source"),
        attendedAt: text("attended_at").notNull(),
        status: text("status", { enum: ["active", "voided"] }).notNull().default("active"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        check("attendance_status_check", sql`${table.status} IN ('active', 'voided')`),
        check(
            "attendance_single_participant_check",
            sql`(${table.clientId} IS NOT NULL AND ${table.childMemberId} IS NULL) OR (${table.clientId} IS NULL AND ${table.childMemberId} IS NOT NULL)`,
        ),
        index("idx_attendance_interest_group_id_date").on(
            table.interestGroupId,
            table.attendanceDate,
        ),
        index("idx_attendance_client_code").on(table.clientCode),
    ],
);

export const coordinatorAttendance = sqliteTable(
    "coordinator_attendance",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        clientId: integer("client_id")
            .references(() => clients.id, { onDelete: "cascade" }),
        childMemberId: integer("child_member_id").references(() => childMembers.id, {
            onDelete: "cascade",
        }),
        clientCode: text("client_code").notNull(),
        attendanceDate: text("attendance_date").notNull(),
        dataSource: text("data_source"),
        attendedAt: text("attended_at").notNull(),
        checkedOutAt: text("checked_out_at"),
        status: text("status", { enum: ["active", "voided"] }).notNull().default("active"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        check(
            "coordinator_attendance_status_check",
            sql`${table.status} IN ('active', 'voided')`,
        ),
        check(
            "coordinator_attendance_single_participant_check",
            sql`(${table.clientId} IS NOT NULL AND ${table.childMemberId} IS NULL) OR (${table.clientId} IS NULL AND ${table.childMemberId} IS NOT NULL)`,
        ),
        index("idx_coordinator_attendance_date").on(table.attendanceDate),
        index("idx_coordinator_attendance_client_date").on(
            table.clientCode,
            table.attendanceDate,
        ),
    ],
);

export const schema = {
    users,
    sessions,
    publicIdentitySessions,
    turnstileVerificationGrants,
    projects,
    clients,
    childMembers,
    organizations,
    organizationContacts,
    receiptAssets,
    receipts,
    receiptAttachments,
    receiptAssetCleanupQueue,
    receiptEditLocks,
    receiptAttachmentStaging,
    scannerLocks,
    activityAssets,
    activityAssetCleanupQueue,
    temporaryParticipants,
    fsiiSurveyResponses,
    activities,
    activityRegistrations,
    activityAiQuestionCache,
    activityAttendance,
    interestGroups,
    attendance,
    coordinatorAttendance,
};

export const schemaTableNames = [
    "app_users",
    "sessions",
    "public_identity_sessions",
    "turnstile_verification_grants",
    "projects",
    "clients",
    "child_members",
    "organizations",
    "organization_contacts",
    "receipt_assets",
    "receipts",
    "receipt_attachments",
    "receipt_asset_cleanup_queue",
    "receipt_edit_locks",
    "receipt_attachment_staging",
    "scanner_locks",
    "activity_assets",
    "activity_asset_cleanup_queue",
    "temporary_participants",
    "fsii_survey_responses",
    "activities",
    "activity_registrations",
    "activity_ai_question_cache",
    "activity_attendance",
    "interest_groups",
    "attendance",
    "coordinator_attendance",
] as const;
