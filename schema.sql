-- SCSC Membership System unified D1 schema

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS import_runs;
DROP TABLE IF EXISTS scanner_locks;
DROP TABLE IF EXISTS receipt_asset_cleanup_queue;
DROP TABLE IF EXISTS receipt_attachment_staging;
DROP TABLE IF EXISTS receipt_edit_locks;
DROP TABLE IF EXISTS receipt_attachments;
DROP TABLE IF EXISTS activity_attendance;
DROP TABLE IF EXISTS activity_ai_question_cache;
DROP TABLE IF EXISTS activity_registrations;
DROP TABLE IF EXISTS activity_registrations_attendance;
DROP TABLE IF EXISTS fsii_survey_responses;
DROP TABLE IF EXISTS temporary_participants;
DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS activity_asset_cleanup_queue;
DROP TABLE IF EXISTS activity_assets;
DROP TABLE IF EXISTS coordinator_attendance;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS interest_groups;
DROP TABLE IF EXISTS receipts;
DROP TABLE IF EXISTS receipt_assets;
DROP TABLE IF EXISTS organization_contacts;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS child_members;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS login_rate_limits;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS public_identity_sessions;
DROP TABLE IF EXISTS turnstile_verification_grants;
DROP TABLE IF EXISTS app_users;
DROP TABLE IF EXISTS users;

PRAGMA foreign_keys = ON;

CREATE TABLE app_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sso_subject TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    display_name TEXT,
    permissions INTEGER NOT NULL DEFAULT 0 CHECK (permissions BETWEEN 0 AND 7),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    sso_access_status TEXT NOT NULL DEFAULT 'unknown' CHECK (sso_access_status IN ('active', 'login_disabled', 'unknown_user', 'unknown')),
    sso_synced_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_app_users_sso_subject ON app_users(sso_subject);
CREATE INDEX idx_app_users_status ON app_users(status);
CREATE INDEX idx_app_users_sso_access_status ON app_users(sso_access_status);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    sso_checked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE public_identity_sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    participant_kind TEXT NOT NULL CHECK (participant_kind IN ('client', 'child_member', 'temporary_participant')),
    participant_id INTEGER NOT NULL,
    participant_code TEXT,
    created_at TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at TEXT
);

CREATE INDEX idx_public_identity_sessions_expires_at ON public_identity_sessions(expires_at);
CREATE INDEX idx_public_identity_sessions_participant ON public_identity_sessions(participant_kind, participant_id);

CREATE TABLE turnstile_verification_grants (
    id TEXT PRIMARY KEY,
    identity_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at TEXT
);

CREATE INDEX idx_turnstile_verification_grants_expires_at ON turnstile_verification_grants(expires_at);

-- Developer-maintained catalog. The frontend exposes only IDs 1 and 2.
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_projects_status ON projects(status);

-- Developer-maintained catalog seed. Keep additional rows only through reviewed migrations;
-- project management is intentionally not exposed by the frontend.
INSERT INTO projects (id, name, status, created_at, updated_at) VALUES
    (1, '金色年华', 'active', '1970-01-01 00:00:00', '1970-01-01 00:00:00'),
    (2, '新视野', 'active', '1970-01-01 00:00:00', '1970-01-01 00:00:00');

CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_code TEXT NOT NULL UNIQUE,
    client_type TEXT NOT NULL CHECK (client_type IN ('Member')),
    membership_type TEXT NOT NULL DEFAULT 'General' CHECK (membership_type IN ('General', 'Lifetime')),
    registration_date TEXT,
    fsii_registration_date TEXT CHECK (fsii_registration_date IS NULL OR (length(fsii_registration_date) = 10 AND coalesce(strftime('%Y-%m-%d', fsii_registration_date) = fsii_registration_date, false))),
    first_name TEXT,
    last_name TEXT,
    legal_name_photo_id_verified INTEGER NOT NULL DEFAULT 0,
    english_name TEXT,
    chinese_name TEXT NOT NULL,
    chinese_name_pinyin TEXT,
    chinese_name_pinyin_compact TEXT,
    chinese_name_pinyin_initials TEXT,
    chinese_name_pinyin_given_surname TEXT,
    chinese_name_search_terms TEXT,
    gender TEXT CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Other')),
    fsii_gender_detail TEXT CHECK (fsii_gender_detail IS NULL OR (gender IS 'Other' AND fsii_gender_detail IN ('Transgender', 'Prefer not to disclose'))),
    other_gender TEXT CHECK (other_gender IS NULL OR (gender IS 'Other' AND fsii_gender_detail IS NULL AND length(other_gender) <= 150)),
    dob TEXT,
    age_years INTEGER CHECK (age_years IS NULL OR (typeof(age_years) = 'integer' AND age_years BETWEEN 0 AND 120)),
    age_updated_date TEXT CHECK (age_updated_date IS NULL OR (length(age_updated_date) = 10 AND coalesce(strftime('%Y-%m-%d', age_updated_date) = age_updated_date, false))),
    cob TEXT,
    birth_province TEXT,
    birth_city TEXT,
    residential_status TEXT,
    is_volunteer INTEGER NOT NULL DEFAULT 0,
    address TEXT,
    community TEXT,
    postal_code TEXT,
    tel TEXT,
    email TEXT,
    wechat_id TEXT,
    emergency_contact_person TEXT,
    emergency_contact_relationship TEXT,
    emergency_contact_tel TEXT,
    referrer_name TEXT,
    director_name TEXT,
    approver_name TEXT,
    major_language TEXT,
    population_group TEXT,
    marital_status TEXT,
    housing_situation TEXT,
    primary_income TEXT,
    grade_in_school INTEGER CHECK (grade_in_school IS NULL OR (typeof(grade_in_school) = 'integer' AND grade_in_school BETWEEN 1 AND 12)),
    number_child INTEGER NOT NULL DEFAULT 0,
    number_adult INTEGER NOT NULL DEFAULT 0,
    highest_grade TEXT,
    education_level TEXT,
    indigenous_identity TEXT CHECK (indigenous_identity IS NULL OR indigenous_identity IN ('Not applicable', 'First Nations (Status/Non-Status)', 'Métis', 'Inuk (Inuit)')),
    arrival_month TEXT CHECK (arrival_month IS NULL OR (length(arrival_month) = 4 AND arrival_month GLOB '[0-9][0-9][0-9][0-9]') OR (length(arrival_month) = 2 AND arrival_month GLOB '[0-9][0-9]' AND cast(arrival_month AS INTEGER) BETWEEN 1 AND 12) OR (length(arrival_month) = 7 AND coalesce(strftime('%Y-%m', arrival_month || '-01') = arrival_month, false))),
    physical_accessibility_difficulty TEXT CHECK (physical_accessibility_difficulty IS NULL OR physical_accessibility_difficulty IN ('Yes, sometimes', 'Yes, often', 'No')),
    cognitive_difficulty TEXT CHECK (cognitive_difficulty IS NULL OR cognitive_difficulty IN ('Yes, sometimes', 'Yes, often', 'No')),
    emotional_mental_health_condition TEXT CHECK (emotional_mental_health_condition IS NULL OR emotional_mental_health_condition IN ('Yes, sometimes', 'Yes, often', 'No')),
    remark TEXT,
    qr_code_key TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_clients_client_code ON clients(client_code);
CREATE INDEX idx_clients_client_type ON clients(client_type);
CREATE INDEX idx_clients_chinese_name ON clients(chinese_name);
CREATE INDEX idx_clients_chinese_name_pinyin ON clients(chinese_name_pinyin);
CREATE INDEX idx_clients_chinese_name_pinyin_compact ON clients(chinese_name_pinyin_compact);
CREATE INDEX idx_clients_chinese_name_pinyin_initials ON clients(chinese_name_pinyin_initials);
CREATE INDEX idx_clients_chinese_name_pinyin_given_surname ON clients(chinese_name_pinyin_given_surname);

CREATE TABLE child_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_code TEXT NOT NULL UNIQUE,
    membership_type TEXT NOT NULL DEFAULT 'General' CHECK (membership_type IN ('General', 'Lifetime')),
    membership_expiry_date TEXT,
    registration_date TEXT,
    first_name TEXT,
    last_name TEXT,
    english_name TEXT,
    chinese_name TEXT NOT NULL,
    chinese_name_pinyin TEXT,
    chinese_name_pinyin_compact TEXT,
    chinese_name_pinyin_initials TEXT,
    chinese_name_pinyin_given_surname TEXT,
    chinese_name_search_terms TEXT,
    gender TEXT CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Other')),
    dob TEXT,
    cob TEXT,
    residential_status TEXT,
    year_of_arrival INTEGER,
    community TEXT,
    postal_code TEXT,
    tel TEXT,
    email TEXT,
    wechat_id TEXT,
    emergency_contact_person TEXT,
    emergency_contact_tel TEXT,
    parent_type TEXT NOT NULL DEFAULT 'non_member' CHECK (parent_type IN ('member', 'non_member')),
    parent_client_id INTEGER,
    parent_temporary_participant_id INTEGER,
    parent_name TEXT,
    parent_contact TEXT,
    major_language TEXT,
    population_group TEXT,
    marital_status TEXT,
    housing_situation TEXT,
    primary_income TEXT,
    number_child INTEGER NOT NULL DEFAULT 0,
    number_adult INTEGER NOT NULL DEFAULT 0,
    highest_grade TEXT,
    education_level TEXT,
    accessibility_q1 TEXT,
    accessibility_q2 TEXT,
    accessibility_q3 TEXT,
    remark TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (parent_client_id) REFERENCES clients(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_temporary_participant_id) REFERENCES temporary_participants(id) ON DELETE SET NULL,
    CHECK ((parent_client_id IS NULL OR (parent_type = 'member' AND parent_temporary_participant_id IS NULL)) AND (parent_temporary_participant_id IS NULL OR (parent_type = 'non_member' AND parent_client_id IS NULL)))
);

CREATE INDEX idx_child_members_child_code ON child_members(child_code);
CREATE INDEX idx_child_members_parent_client_id ON child_members(parent_client_id);
CREATE INDEX idx_child_members_parent_temporary_participant_id ON child_members(parent_temporary_participant_id);
CREATE INDEX idx_child_members_chinese_name ON child_members(chinese_name);
CREATE INDEX idx_child_members_chinese_name_pinyin ON child_members(chinese_name_pinyin);
CREATE INDEX idx_child_members_chinese_name_pinyin_compact ON child_members(chinese_name_pinyin_compact);
CREATE INDEX idx_child_members_chinese_name_pinyin_initials ON child_members(chinese_name_pinyin_initials);
CREATE INDEX idx_child_members_chinese_name_pinyin_given_surname ON child_members(chinese_name_pinyin_given_surname);

CREATE TABLE organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_code TEXT NOT NULL UNIQUE,
    registration_date TEXT,
    english_name TEXT NOT NULL,
    chinese_name TEXT NOT NULL,
    chinese_name_pinyin TEXT,
    chinese_name_pinyin_compact TEXT,
    chinese_name_pinyin_initials TEXT,
    chinese_name_pinyin_given_surname TEXT,
    chinese_name_search_terms TEXT,
    community TEXT,
    postal_code TEXT,
    tel TEXT,
    email TEXT,
    wechat_id TEXT,
    website TEXT,
    remark TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_organizations_organization_code ON organizations(organization_code);
CREATE INDEX idx_organizations_chinese_name ON organizations(chinese_name);
CREATE INDEX idx_organizations_chinese_name_pinyin ON organizations(chinese_name_pinyin);
CREATE INDEX idx_organizations_chinese_name_pinyin_compact ON organizations(chinese_name_pinyin_compact);
CREATE INDEX idx_organizations_chinese_name_pinyin_initials ON organizations(chinese_name_pinyin_initials);
CREATE INDEX idx_organizations_chinese_name_pinyin_given_surname ON organizations(chinese_name_pinyin_given_surname);

CREATE TABLE organization_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    chinese_name TEXT NOT NULL,
    chinese_name_search_terms TEXT,
    english_name TEXT NOT NULL,
    tel TEXT,
    email TEXT,
    wechat_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_organization_contacts_organization_id ON organization_contacts(organization_id);

CREATE TABLE receipt_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    r2_key TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    created_at TEXT NOT NULL
);

CREATE TABLE receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_no TEXT NOT NULL UNIQUE,
    payer_client_id INTEGER,
    payer_child_member_id INTEGER,
    payer_organization_id INTEGER,
    attachment_asset_id INTEGER,
    issue_date TEXT NOT NULL,
    membership_year INTEGER,
    currency TEXT NOT NULL DEFAULT 'CAD',
    amount REAL NOT NULL DEFAULT 0,
    payment_type TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    designated_person_id INTEGER,
    remark TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK ((payer_client_id IS NULL OR payer_child_member_id IS NULL) AND (payer_client_id IS NULL OR payer_organization_id IS NULL) AND (payer_child_member_id IS NULL OR payer_organization_id IS NULL)),
    FOREIGN KEY (payer_client_id) REFERENCES clients(id) ON DELETE SET NULL,
    FOREIGN KEY (payer_child_member_id) REFERENCES child_members(id) ON DELETE SET NULL,
    FOREIGN KEY (payer_organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
    FOREIGN KEY (designated_person_id) REFERENCES app_users(id) ON DELETE SET NULL,
    FOREIGN KEY (attachment_asset_id) REFERENCES receipt_assets(id) ON DELETE SET NULL
);

CREATE INDEX idx_receipts_payer_client_id ON receipts(payer_client_id);
CREATE INDEX idx_receipts_payer_child_member_id ON receipts(payer_child_member_id);
CREATE INDEX idx_receipts_payer_organization_id ON receipts(payer_organization_id);
CREATE INDEX idx_receipts_designated_person_id ON receipts(designated_person_id);
CREATE INDEX idx_receipts_issue_date ON receipts(issue_date);
CREATE INDEX idx_receipts_payment_type ON receipts(payment_type);
CREATE INDEX idx_receipts_payer_client_membership_year ON receipts(payer_client_id, payment_type, status, membership_year);
CREATE INDEX idx_receipts_payer_child_membership_year ON receipts(payer_child_member_id, payment_type, status, membership_year);

CREATE TABLE receipt_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id INTEGER NOT NULL,
    asset_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES receipt_assets(id) ON DELETE CASCADE,
    UNIQUE(receipt_id, asset_id)
);

CREATE INDEX idx_receipt_attachments_receipt_order ON receipt_attachments(receipt_id, sort_order);
CREATE INDEX idx_receipt_attachments_asset_id ON receipt_attachments(asset_id);

CREATE TABLE receipt_asset_cleanup_queue (
    asset_id INTEGER PRIMARY KEY NOT NULL,
    r2_key TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    attempts INTEGER DEFAULT 0 NOT NULL,
    next_attempt_at_ms INTEGER DEFAULT 0 NOT NULL,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE receipt_attachment_staging (
    id TEXT PRIMARY KEY NOT NULL,
    asset_id INTEGER NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    form_session_id TEXT NOT NULL,
    receipt_id INTEGER,
    created_at_ms INTEGER NOT NULL,
    expires_at_ms INTEGER NOT NULL,
    FOREIGN KEY (asset_id) REFERENCES receipt_assets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
    FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
);

CREATE INDEX idx_receipt_attachment_staging_owner ON receipt_attachment_staging(user_id, form_session_id);
CREATE INDEX idx_receipt_attachment_staging_expires_at ON receipt_attachment_staging(expires_at_ms);

CREATE TABLE receipt_edit_locks (
    receipt_id INTEGER PRIMARY KEY NOT NULL,
    lock_token TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    acquired_at_ms INTEGER NOT NULL,
    last_activity_at_ms INTEGER NOT NULL,
    expires_at_ms INTEGER NOT NULL,
    FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_receipt_edit_locks_expires_at ON receipt_edit_locks(expires_at_ms);
CREATE INDEX idx_receipt_edit_locks_user_id ON receipt_edit_locks(user_id);

CREATE TABLE scanner_locks (
    device_key TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    started_at_ms INTEGER NOT NULL,
    expires_at_ms INTEGER NOT NULL,
    message_id TEXT,
    attachment_id TEXT,
    file_name TEXT,
    received_at TEXT
);

CREATE TABLE activity_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    r2_key TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE activity_asset_cleanup_queue (
    asset_id INTEGER PRIMARY KEY,
    r2_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'pending', 'claimed')),
    lease_token TEXT,
    lease_expires_at_ms INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at_ms INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (asset_id) REFERENCES activity_assets(id) ON DELETE CASCADE
);

CREATE INDEX idx_activity_asset_cleanup_queue_eligibility ON activity_asset_cleanup_queue(status, next_attempt_at_ms, lease_expires_at_ms);

CREATE TABLE temporary_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fsii_registration_date TEXT CHECK (fsii_registration_date IS NULL OR (length(fsii_registration_date) = 10 AND coalesce(strftime('%Y-%m-%d', fsii_registration_date) = fsii_registration_date, false))),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    legal_name_photo_id_verified INTEGER NOT NULL DEFAULT 0,
    english_name TEXT,
    chinese_name TEXT,
    chinese_name_pinyin TEXT,
    chinese_name_pinyin_compact TEXT,
    chinese_name_pinyin_initials TEXT,
    chinese_name_pinyin_given_surname TEXT,
    chinese_name_search_terms TEXT,
    gender TEXT CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Other')),
    fsii_gender_detail TEXT CHECK (fsii_gender_detail IS NULL OR (gender IS 'Other' AND fsii_gender_detail IN ('Transgender', 'Prefer not to disclose'))),
    other_gender TEXT CHECK (other_gender IS NULL OR (gender IS 'Other' AND fsii_gender_detail IS NULL AND length(other_gender) <= 150)),
    dob TEXT,
    age_years INTEGER CHECK (age_years IS NULL OR (typeof(age_years) = 'integer' AND age_years BETWEEN 0 AND 120)),
    age_updated_date TEXT CHECK (age_updated_date IS NULL OR (length(age_updated_date) = 10 AND coalesce(strftime('%Y-%m-%d', age_updated_date) = age_updated_date, false))),
    cob TEXT,
    birth_province TEXT,
    birth_city TEXT,
    residential_status TEXT,
    is_volunteer INTEGER NOT NULL DEFAULT 0,
    address TEXT,
    community TEXT,
    postal_code TEXT,
    tel TEXT NOT NULL,
    email TEXT NOT NULL,
    wechat_id TEXT,
    emergency_contact_person TEXT,
    emergency_contact_relationship TEXT,
    emergency_contact_tel TEXT,
    major_language TEXT,
    population_group TEXT,
    marital_status TEXT,
    housing_situation TEXT,
    primary_income TEXT,
    grade_in_school INTEGER CHECK (grade_in_school IS NULL OR (typeof(grade_in_school) = 'integer' AND grade_in_school BETWEEN 1 AND 12)),
    number_child INTEGER NOT NULL DEFAULT 0,
    number_adult INTEGER NOT NULL DEFAULT 0,
    highest_grade TEXT,
    education_level TEXT,
    indigenous_identity TEXT CHECK (indigenous_identity IS NULL OR indigenous_identity IN ('Not applicable', 'First Nations (Status/Non-Status)', 'Métis', 'Inuk (Inuit)')),
    arrival_month TEXT CHECK (arrival_month IS NULL OR (length(arrival_month) = 4 AND arrival_month GLOB '[0-9][0-9][0-9][0-9]') OR (length(arrival_month) = 2 AND arrival_month GLOB '[0-9][0-9]' AND cast(arrival_month AS INTEGER) BETWEEN 1 AND 12) OR (length(arrival_month) = 7 AND coalesce(strftime('%Y-%m', arrival_month || '-01') = arrival_month, false))),
    physical_accessibility_difficulty TEXT CHECK (physical_accessibility_difficulty IS NULL OR physical_accessibility_difficulty IN ('Yes, sometimes', 'Yes, often', 'No')),
    cognitive_difficulty TEXT CHECK (cognitive_difficulty IS NULL OR cognitive_difficulty IN ('Yes, sometimes', 'Yes, often', 'No')),
    emotional_mental_health_condition TEXT CHECK (emotional_mental_health_condition IS NULL OR emotional_mental_health_condition IN ('Yes, sometimes', 'Yes, often', 'No')),
    remark TEXT,
    converted_client_id INTEGER,
    converted_at TEXT CHECK ((converted_at IS NULL AND converted_client_id IS NULL) OR (converted_at IS NOT NULL AND converted_client_id IS NOT NULL AND status = 'disabled' AND length(converted_at) = 19 AND coalesce(strftime('%Y-%m-%d %H:%M:%S', converted_at) = converted_at, false))),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (converted_client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    CONSTRAINT temporary_participants_dob_check CHECK (
        dob IS NULL OR (
            dob GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
            AND date(dob, '+0 days') IS NOT NULL
            AND date(dob, '+0 days') = dob
            AND dob >= '1900-01-01'
        )
    ),
    CONSTRAINT temporary_participants_dob_age_exclusive_check CHECK (NOT (dob IS NOT NULL AND age_years IS NOT NULL)),
    CONSTRAINT temporary_participants_age_pair_check CHECK ((age_years IS NULL) = (age_updated_date IS NULL))
);

CREATE UNIQUE INDEX temporary_participants_name_dob_unique ON temporary_participants(lower(replace(replace(replace(replace(replace(replace(replace(replace(trim(replace(replace(replace(replace(replace(first_name, char(9), ' '), char(10), ' '), char(11), ' '), char(12), ' '), char(13), ' ')), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' ')) || ' ' || lower(replace(replace(replace(replace(replace(replace(replace(replace(trim(replace(replace(replace(replace(replace(last_name, char(9), ' '), char(10), ' '), char(11), ' '), char(12), ' '), char(13), ' ')), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' ')), dob);
CREATE TRIGGER temporary_participants_structured_name_insert BEFORE INSERT ON temporary_participants
WHEN NEW.first_name IS NULL OR length(replace(replace(replace(replace(replace(replace(replace(replace(trim(replace(replace(replace(replace(replace(NEW.first_name, char(9), ' '), char(10), ' '), char(11), ' '), char(12), ' '), char(13), ' ')), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' ')) = 0 OR NEW.last_name IS NULL OR length(replace(replace(replace(replace(replace(replace(replace(replace(trim(replace(replace(replace(replace(replace(NEW.last_name, char(9), ' '), char(10), ' '), char(11), ' '), char(12), ' '), char(13), ' ')), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' ')) = 0
BEGIN SELECT RAISE(ABORT, 'temporary_participant_name_required'); END;
CREATE TRIGGER temporary_participants_structured_name_update BEFORE UPDATE OF first_name, last_name ON temporary_participants
WHEN NEW.first_name IS NULL OR length(replace(replace(replace(replace(replace(replace(replace(replace(trim(replace(replace(replace(replace(replace(NEW.first_name, char(9), ' '), char(10), ' '), char(11), ' '), char(12), ' '), char(13), ' ')), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' ')) = 0 OR NEW.last_name IS NULL OR length(replace(replace(replace(replace(replace(replace(replace(replace(trim(replace(replace(replace(replace(replace(NEW.last_name, char(9), ' '), char(10), ' '), char(11), ' '), char(12), ' '), char(13), ' ')), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' ')) = 0
BEGIN SELECT RAISE(ABORT, 'temporary_participant_name_required'); END;
CREATE INDEX idx_temporary_participants_chinese_name_pinyin ON temporary_participants(chinese_name_pinyin);
CREATE INDEX idx_temporary_participants_chinese_name_pinyin_compact ON temporary_participants(chinese_name_pinyin_compact);
CREATE INDEX idx_temporary_participants_chinese_name_pinyin_initials ON temporary_participants(chinese_name_pinyin_initials);
CREATE INDEX idx_temporary_participants_chinese_name_pinyin_given_surname ON temporary_participants(chinese_name_pinyin_given_surname);
CREATE INDEX idx_temporary_participants_status ON temporary_participants(status);
CREATE UNIQUE INDEX temporary_participants_converted_client_unique ON temporary_participants (converted_client_id) WHERE converted_client_id IS NOT NULL;

CREATE TABLE fsii_survey_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    temporary_participant_id INTEGER,
    survey_type TEXT NOT NULL CHECK (survey_type IN ('community_participation', 'satisfaction')),
    answered_date TEXT NOT NULL CHECK (
        answered_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        AND date(answered_date, '+0 days') IS NOT NULL
        AND date(answered_date, '+0 days') = answered_date
    ),
    uploaded_date TEXT,
    fsii_submission_date TEXT,
    questionnaire_version TEXT NOT NULL,
    answer_1 TEXT,
    answer_2 TEXT,
    answer_3 TEXT,
    answer_4 TEXT,
    answer_5 TEXT,
    answer_6 TEXT,
    answer_7 TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL,
    CHECK ((client_id IS NOT NULL AND temporary_participant_id IS NULL) OR (client_id IS NULL AND temporary_participant_id IS NOT NULL)),
    CHECK (
        (answer_1 IS NOT NULL AND answer_2 IS NOT NULL AND answer_3 IS NOT NULL AND answer_4 IS NOT NULL AND answer_5 IS NOT NULL
            AND answer_1 IN ('Never, or almost never', 'Rarely', 'Occasionally', 'Quite often', 'Very often', 'Always, or almost always')
            AND answer_2 IN ('Never, or almost never', 'Rarely', 'Occasionally', 'Quite often', 'Very often', 'Always, or almost always')
            AND answer_3 IN ('Never, or almost never', 'Rarely', 'Occasionally', 'Quite often', 'Very often', 'Always, or almost always')
            AND answer_4 IN ('Never, or almost never', 'Rarely', 'Occasionally', 'Quite often', 'Very often', 'Always, or almost always')
            AND answer_5 IN ('Never, or almost never', 'Rarely', 'Occasionally', 'Quite often', 'Very often', 'Always, or almost always'))
        OR
        (answer_6 IS NOT NULL AND answer_7 IS NOT NULL
            AND answer_6 IN ('Strongly disagree', 'Disagree', 'Neither', 'Agree', 'Strongly agree', 'N/A')
            AND answer_7 IN ('Strongly disagree', 'Disagree', 'Neither', 'Agree', 'Strongly agree', 'N/A'))
    ),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    FOREIGN KEY (temporary_participant_id) REFERENCES temporary_participants(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX fsii_survey_responses_client_unique ON fsii_survey_responses (client_id, answered_date) WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX fsii_survey_responses_temporary_unique ON fsii_survey_responses (temporary_participant_id, answered_date) WHERE temporary_participant_id IS NOT NULL;
CREATE INDEX idx_fsii_survey_responses_client_date ON fsii_survey_responses (client_id, answered_date);
CREATE INDEX idx_fsii_survey_responses_temporary_date ON fsii_survey_responses (temporary_participant_id, answered_date);
CREATE INDEX idx_fsii_survey_responses_type_date ON fsii_survey_responses (survey_type, answered_date);

CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    project_id INTEGER,
    image_asset_id INTEGER,
    held_at TEXT,
    expected_participants INTEGER NOT NULL DEFAULT 10 CHECK (typeof(expected_participants) = 'integer' AND expected_participants >= 0),
    waitlist_percentage INTEGER NOT NULL DEFAULT 10 CHECK (typeof(waitlist_percentage) = 'integer' AND waitlist_percentage BETWEEN 1 AND 100),
    questions TEXT NOT NULL DEFAULT '{"questions":[]}' CHECK (json_valid(questions) AND json_type(questions) = 'object'),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    require_registration_for_check_in INTEGER NOT NULL DEFAULT true,
    integrity_enabled INTEGER NOT NULL DEFAULT false,
    edit_revision INTEGER NOT NULL DEFAULT 1 CHECK (typeof(edit_revision) = 'integer' AND edit_revision > 0 AND edit_revision <= 9007199254740991),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (image_asset_id) REFERENCES activity_assets(id) ON DELETE SET NULL
);

CREATE INDEX idx_activities_project_id ON activities(project_id);
CREATE INDEX idx_activities_status_held_at ON activities(status, held_at);
CREATE INDEX idx_activities_name ON activities(name);

CREATE TABLE activity_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER NOT NULL,
    client_id INTEGER,
    child_member_id INTEGER,
    temporary_participant_id INTEGER,
    client_code TEXT NOT NULL,
    registration_status TEXT NOT NULL DEFAULT 'active' CHECK (registration_status IN ('active', 'waitlisted', 'cancelled')),
    registered_at TEXT,
    waitlisted_at TEXT,
    registration_updated_at TEXT,
    integrity_late_cancelled_at TEXT,
    answers TEXT NOT NULL DEFAULT '{"answers":[]}' CHECK (json_valid(answers) AND json_type(answers) = 'object'),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK ((client_id IS NOT NULL AND child_member_id IS NULL AND temporary_participant_id IS NULL) OR (client_id IS NULL AND child_member_id IS NOT NULL AND temporary_participant_id IS NULL) OR (client_id IS NULL AND child_member_id IS NULL AND temporary_participant_id IS NOT NULL)),
    FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (child_member_id) REFERENCES child_members(id) ON DELETE CASCADE,
    FOREIGN KEY (temporary_participant_id) REFERENCES temporary_participants(id) ON DELETE RESTRICT,
    UNIQUE(activity_id, client_code)
);

CREATE INDEX idx_activity_registrations_activity_status ON activity_registrations(activity_id, registration_status);
CREATE INDEX idx_activity_registrations_client_code ON activity_registrations(client_code);
CREATE INDEX idx_activity_registrations_temporary_participant_id ON activity_registrations(temporary_participant_id);

CREATE TABLE activity_ai_question_cache (
    cache_key TEXT PRIMARY KEY NOT NULL,
    activity_id INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    current_answer TEXT NOT NULL,
    other_answers TEXT NOT NULL CHECK (json_valid(other_answers) AND json_type(other_answers) = 'array'),
    data TEXT NOT NULL CHECK (json_valid(data) AND json_type(data) = 'array'),
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);

CREATE INDEX idx_activity_ai_question_cache_activity_question ON activity_ai_question_cache(activity_id, question_id);
CREATE INDEX idx_activity_ai_question_cache_expires_at ON activity_ai_question_cache(expires_at);

CREATE TABLE activity_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER NOT NULL,
    client_id INTEGER,
    child_member_id INTEGER,
    temporary_participant_id INTEGER,
    client_code TEXT NOT NULL,
    attendance_status TEXT NOT NULL DEFAULT 'active' CHECK (attendance_status IN ('active', 'voided')),
    attended_at TEXT,
    attendance_source TEXT,
    was_registered_when_attended INTEGER NOT NULL DEFAULT 0 CHECK (was_registered_when_attended IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK ((client_id IS NOT NULL AND child_member_id IS NULL AND temporary_participant_id IS NULL) OR (client_id IS NULL AND child_member_id IS NOT NULL AND temporary_participant_id IS NULL) OR (client_id IS NULL AND child_member_id IS NULL AND temporary_participant_id IS NOT NULL)),
    FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (child_member_id) REFERENCES child_members(id) ON DELETE CASCADE,
    FOREIGN KEY (temporary_participant_id) REFERENCES temporary_participants(id) ON DELETE RESTRICT,
    UNIQUE(activity_id, client_code)
);

CREATE INDEX idx_activity_attendance_activity_status ON activity_attendance(activity_id, attendance_status);
CREATE INDEX idx_activity_attendance_client_code ON activity_attendance(client_code);
CREATE INDEX idx_activity_attendance_temporary_participant_id ON activity_attendance(temporary_participant_id);

CREATE TABLE interest_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    default_attendance_date TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_interest_groups_name ON interest_groups(name);

CREATE TABLE attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interest_group_id INTEGER NOT NULL,
    interest_group_name TEXT,
    client_id INTEGER,
    child_member_id INTEGER,
    client_code TEXT NOT NULL,
    attendance_date TEXT NOT NULL,
    data_source TEXT,
    attended_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK ((client_id IS NOT NULL AND child_member_id IS NULL) OR (client_id IS NULL AND child_member_id IS NOT NULL)),
    FOREIGN KEY (interest_group_id) REFERENCES interest_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (child_member_id) REFERENCES child_members(id) ON DELETE CASCADE
);

CREATE INDEX idx_attendance_interest_group_id_date ON attendance(interest_group_id, attendance_date);
CREATE INDEX idx_attendance_client_code ON attendance(client_code);

CREATE TABLE coordinator_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    child_member_id INTEGER,
    client_code TEXT NOT NULL,
    attendance_date TEXT NOT NULL,
    data_source TEXT,
    attended_at TEXT NOT NULL,
    checked_out_at TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK ((client_id IS NOT NULL AND child_member_id IS NULL) OR (client_id IS NULL AND child_member_id IS NOT NULL)),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (child_member_id) REFERENCES child_members(id) ON DELETE CASCADE
);

CREATE INDEX idx_coordinator_attendance_date ON coordinator_attendance(attendance_date);
CREATE INDEX idx_coordinator_attendance_client_date ON coordinator_attendance(client_code, attendance_date);
