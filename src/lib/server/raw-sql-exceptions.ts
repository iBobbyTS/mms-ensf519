export const RAW_SQL_EXCEPTIONS = {
    "domain.complex-directory-and-search": {
        files: ["src/lib/server/domain.ts"],
        reason: "Directory search, pinyin matching, membership-state sorting, and cross-entity payer lookup still use dynamic SQL that is clearer as raw SQL.",
        removalCondition: "Replace with Drizzle query-builder helpers that preserve the current search ranking and membership-state ordering semantics.",
    },
    "client-detail.participation-summary": {
        files: ["src/lib/server/client-detail-page.ts", "src/lib/server/child-member-detail-page.ts"],
        reason: "Client participation summaries combine activity attendance and interest-group attendance aggregates across years.",
        removalCondition: "Convert the union/aggregate summary queries to Drizzle with regression coverage for year selection and participation totals.",
    },
    "verify-legacy-sql.mysql-probe": {
        files: ["scripts/verify-legacy-sql-import-in-container.sh"],
        reason: "The raw legacy SQL smoke test must query MySQL metadata inside a temporary legacy container.",
        removalCondition: "Replace the shell probe with a typed MySQL verification helper if the legacy SQL smoke grows beyond table-health checks.",
    },
    "receipt.atomic-edit-and-cleanup": {
        files: [
            "src/lib/server/receipt-attachments.ts",
            "src/lib/server/receipt-attachment-staging.ts",
            "src/lib/server/receipt-asset-upload.ts",
        ],
        reason: "Receipt fields, attachment links, upload reservations, staging ownership, and detached-asset cleanup records must cross their related D1 state transitions in atomic batches.",
        removalCondition: "Replace when Drizzle exposes a D1 transaction API with equivalent atomic batch coverage.",
    },
    "receipt.staging-expiry-cleanup": {
        files: ["src/lib/server/receipt-attachment-staging.ts"],
        reason: "Expired staging ownership rows must move to the durable asset cleanup queue in the same D1 batch that releases their staging claims.",
        removalCondition: "Replace when Drizzle exposes a D1 transaction API with equivalent atomic batch coverage.",
    },
    "activity.asset-lifecycle": {
        files: ["src/lib/server/activity-assets.ts"],
        reason: "Activity upload reservations, lease claims, durable cleanup, and formal activity association must cross D1 state transitions in guarded atomic batches.",
        removalCondition: "Replace when Drizzle exposes D1 transactions and conditional insert identifiers with equivalent fault and interleaving coverage.",
    },
    "activity.create-active-project": {
        files: ["src/lib/server/domain.ts"],
        reason: "Activity creation must validate an optional active project in the same statement that inserts the activity and must distinguish an explicit zero-write result.",
        removalCondition: "Replace when Drizzle exposes conditional INSERT result metadata with equivalent project-race and ambiguous-result coverage.",
    },
    "activity.update-questionnaire-atomic": {
        files: ["src/lib/server/domain.ts"],
        reason: "Activity edits must clear registration answers in the same guarded D1 batch when the questionnaire changes.",
        removalCondition: "Replace with an equivalent transactional Drizzle update preserving questionnaire-change atomicity.",
    },
    "activity.check-in-registration-gate": {
        files: ["src/lib/server/domain.ts"],
        reason: "Activity check-in must recheck the active activity gate and stable-identity active registration in the same statement that inserts or restores attendance.",
        removalCondition: "Replace when Drizzle exposes conditional INSERT and UPDATE result metadata with equivalent D1 interleaving coverage.",
    },
    "activity.manual-entry": {
        files: ["src/lib/server/domain.ts"],
        reason: "Manual activity entry must atomically upsert the active registration and insert or restore the gate-checked attendance record in one D1 batch.",
        removalCondition: "Replace when Drizzle exposes supported D1 transactions and conditional writes with equivalent registration-upsert and attendance-gate coverage.",
    },
    "project.atomic-disable-and-unlink": {
        files: ["src/lib/server/domain.ts"],
        reason: "Project disablement must unlink every active or disabled activity, increment each activity revision, and update the project in one guarded D1 batch with a normal zero-result reconciliation read.",
        removalCondition: "Replace when Drizzle exposes D1 transactions and consistent cross-table reconciliation reads with equivalent ceiling, fault, and interleaving coverage.",
    },
    "business-time.normalize-script": {
        files: ["scripts/normalize-business-time.ts"],
        reason: "The one-off business-time format normalization script must inspect exported SQLite metadata and generate guarded UPDATE statements across a dynamic table/column allowlist.",
        removalCondition: "Remove after production business-time format normalization is completed and archived, or replace with a first-class Drizzle migration if the same operation becomes recurring.",
    },
    "chinese-name-search.backfill-script": {
        files: ["scripts/backfill-chinese-name-search-terms.ts"],
        reason: "The Chinese-name search backfill script must inspect exported SQLite metadata and generate guarded UPDATE statements across a fixed table allowlist.",
        removalCondition: "Remove after all persisted Chinese-name rows have been backfilled in production and local seed/reset paths no longer need the script.",
    },
    "temporary-participant-search.backfill-script": {
        files: ["scripts/backfill-temporary-participant-search.ts"],
        reason: "The temporary-participant search backfill script must inspect exported SQLite metadata and generate guarded UPDATE statements for the temporary_participants table.",
        removalCondition: "Remove after all persisted temporary participants have been backfilled in production and local seed/reset paths no longer need the script.",
    },
    "public-activity-registration.atomic-write": {
        files: ["src/lib/server/public-activity-registration.ts"],
        reason: "Public registration must recheck activity and participant eligibility in the same D1 statement that inserts or revives a registration, while new temporary participants and registrations must commit in one guarded batch.",
        removalCondition: "Replace with supported Drizzle conditional-write and D1 transaction APIs that preserve the same eligibility and atomicity contract coverage.",
    },
    "child-member.atomic-parent-save": {
        files: ["src/lib/server/domain.ts"],
        reason: "Child saves must recheck an active parent identity, and inline non-member creation must commit atomically with the child write.",
        removalCondition: "Replace when Drizzle exposes supported D1 transactions and conditional writes with equivalent parent eligibility and rollback coverage.",
    },
    "temporary-participant.atomic-conversion": {
        files: ["src/lib/server/temporary-participant-conversion.ts"],
        reason: "Creating a member and transferring every temporary identity reference, redundant code, session, and conversion marker must commit in one guarded D1 batch.",
        removalCondition: "Replace when Drizzle exposes supported D1 transactions with equivalent conditional-write and rollback coverage.",
    },
    "fsii-survey-responses.active-temporary-write": {
        files: ["src/lib/server/fsii-survey-responses.ts"],
        reason: "FSII survey writes must recheck that a temporary participant is active and unconverted in the same INSERT statement that creates the survey response.",
        removalCondition: "Replace when the Drizzle values insert can express the temporary-participant lifecycle predicate atomically while preserving affected-row metadata.",
    },
    "seed.demo-data": {
        files: ["scripts/seed.ts"],
        reason: "The demo seed script inserts demo interest groups, members, receipts, attendance, and survey responses into the local D1 database as plain SQL.",
        removalCondition: "Replace with Drizzle inserts if the seed grows beyond simple demo fixtures.",
    },
} as const;

export type RawSqlReasonKey = keyof typeof RAW_SQL_EXCEPTIONS;

const rawSqlReasonKeys = new Set<string>(Object.keys(RAW_SQL_EXCEPTIONS));

export function assertRawSqlReason(reasonKey: RawSqlReasonKey): void {
    if (!rawSqlReasonKeys.has(reasonKey)) {
        throw new Error(`未登记的 raw SQL 例外：${reasonKey}`);
    }
}
