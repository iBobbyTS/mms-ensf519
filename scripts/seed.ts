// Demo seed for the local D1 database. Run after `bun run db:reset:local`
// (or use `bun run dev:reset`). Idempotent against a fresh schema only.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildChineseNameSearchIndex } from "../src/lib/server/client-name-index.ts";
import {
    addBusinessDateDays,
    businessDateDaysBefore,
    currentBusinessYear,
    formatBusinessDateTime,
    todayBusinessDate,
} from "../src/lib/local-date.ts";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const now = new Date();
const nowDate = todayBusinessDate(now);
const nowDateTime = formatBusinessDateTime(now);
const thisYear = currentBusinessYear(now);
const lastYear = thisYear - 1;

function sql(value: string | number | null): string {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "number") return String(value);
    return `'${value.replace(/'/g, "''")}'`;
}

type SeedMember = {
    code: string;
    chineseName: string;
    firstName: string;
    lastName: string;
    englishName?: string;
    gender: "Male" | "Female";
    dob: string;
    tel: string;
    membershipType: "General" | "Lifetime";
    receiptYear: number | null;
    status: "active" | "disabled";
    community?: string;
};

const members: SeedMember[] = [
    { code: "SCSC0001", chineseName: "王伟", firstName: "Wei", lastName: "Wang", gender: "Male", dob: "1958-03-12", tel: "403-555-0101", membershipType: "General", receiptYear: thisYear, status: "active", community: "Bridgeland" },
    { code: "SCSC0002", chineseName: "李秀兰", firstName: "Xiulan", lastName: "Li", gender: "Female", dob: "1962-07-25", tel: "403-555-0102", membershipType: "General", receiptYear: thisYear, status: "active" },
    { code: "SCSC0003", chineseName: "张敏", firstName: "Min", lastName: "Zhang", gender: "Female", dob: "1970-11-02", tel: "403-555-0103", membershipType: "General", receiptYear: lastYear, status: "active" },
    { code: "SCSC0004", chineseName: "陈建国", firstName: "Jianguo", lastName: "Chen", gender: "Male", dob: "1955-01-30", tel: "403-555-0104", membershipType: "Lifetime", receiptYear: null, status: "active" },
    { code: "SCSC0005", chineseName: "刘静", firstName: "Jing", lastName: "Liu", gender: "Female", dob: "1985-05-18", tel: "403-555-0105", membershipType: "General", receiptYear: null, status: "active" },
    { code: "SCSC0006", chineseName: "赵强", firstName: "Qiang", lastName: "Zhao", gender: "Male", dob: "1968-09-09", tel: "403-555-0106", membershipType: "General", receiptYear: thisYear, status: "active" },
    { code: "SCSC0007", chineseName: "孙丽丽", firstName: "Lili", lastName: "Sun", gender: "Female", dob: "1990-04-14", tel: "403-555-0107", membershipType: "General", receiptYear: thisYear, status: "active" },
    { code: "SCSC0008", chineseName: "周军", firstName: "Jun", lastName: "Zhou", gender: "Male", dob: "1959-12-01", tel: "403-555-0108", membershipType: "General", receiptYear: lastYear, status: "active" },
    { code: "SCSC0009", chineseName: "吴秀英", firstName: "Xiuying", lastName: "Wu", gender: "Female", dob: "1963-06-21", tel: "403-555-0109", membershipType: "General", receiptYear: thisYear, status: "active" },
    { code: "SCSC0010", chineseName: "郑海涛", firstName: "Haitao", lastName: "Zheng", gender: "Male", dob: "1975-02-08", tel: "403-555-0110", membershipType: "General", receiptYear: null, status: "active" },
    { code: "SCSC0011", chineseName: "林美玲", firstName: "Meiling", lastName: "Lin", englishName: "May Lin", gender: "Female", dob: "1982-08-16", tel: "403-555-0111", membershipType: "General", receiptYear: thisYear, status: "disabled" },
    { code: "SCSC0012", chineseName: "黄志强", firstName: "Zhiqiang", lastName: "Huang", gender: "Male", dob: "1966-10-27", tel: "403-555-0112", membershipType: "General", receiptYear: thisYear, status: "active" },
    { code: "SCSC0013", chineseName: "马丽", firstName: "Li", lastName: "Ma", englishName: "Mary Ma", gender: "Female", dob: "1993-03-03", tel: "403-555-0113", membershipType: "General", receiptYear: thisYear, status: "active" },
    { code: "SCSC0014", chineseName: "高文彬", firstName: "Wenbin", lastName: "Gao", gender: "Male", dob: "1971-07-07", tel: "403-555-0114", membershipType: "General", receiptYear: lastYear, status: "active" },
];

const interestGroups = [
    { name: "合唱团 (Choir)", sort: 1 },
    { name: "舞蹈班 (Dance Class)", sort: 2 },
    { name: "太极拳 (Tai Chi)", sort: 3 },
    { name: "书法社 (Calligraphy)", sort: 4 },
    { name: "摄影俱乐部 (Photography Club)", sort: 5 },
];

// [groupIndex, memberIndex, daysAgo]
const attendancePlan: Array<[number, number, number]> = [
    [0, 0, 0], [0, 1, 0], [0, 5, 0], [0, 3, 0],
    [0, 0, 7], [0, 1, 7], [0, 7, 7],
    [1, 2, 0], [1, 4, 0], [1, 9, 0],
    [1, 2, 5], [1, 6, 5], [1, 11, 5], [1, 4, 12],
    [2, 3, 0], [2, 6, 0], [2, 8, 0], [2, 12, 0],
    [2, 3, 4], [2, 8, 4], [2, 5, 11], [2, 13, 11],
    [3, 7, 0], [3, 10, 0],
    [3, 1, 9], [3, 9, 9],
    [4, 11, 0],
    [4, 12, 6], [4, 0, 6],
];

const fsiiSurveyMemberCodes = ["SCSC0002", "SCSC0006", "SCSC0009"];

function clientInsert(member: SeedMember): string {
    const pinyinIndex = buildChineseNameSearchIndex(member.chineseName);
    const columns = [
        "client_code", "client_type", "membership_type", "registration_date",
        "first_name", "last_name", "english_name", "chinese_name",
        "chinese_name_pinyin", "chinese_name_pinyin_compact",
        "chinese_name_pinyin_initials", "chinese_name_pinyin_given_surname",
        "chinese_name_search_terms", "gender", "dob", "tel", "community",
        "status", "created_at", "updated_at",
    ];
    const values = [
        member.code, "Member", member.membershipType, `${thisYear}-01-15`,
        member.firstName, member.lastName, member.englishName ?? null, member.chineseName,
        pinyinIndex.pinyin, pinyinIndex.pinyinCompact,
        pinyinIndex.pinyinInitials, pinyinIndex.pinyinGivenSurname,
        pinyinIndex.searchTerms, member.gender, member.dob, member.tel, member.community ?? null,
        member.status, nowDateTime, nowDateTime,
    ];
    return `INSERT INTO clients (${columns.join(", ")}) VALUES (${values.map(sql).join(", ")})`;
}

function receiptInserts(): string[] {
    const statements: string[] = [];
    let sequence = 1;
    for (const member of members) {
        if (member.receiptYear === null) continue;
        statements.push(`INSERT INTO receipts (receipt_no, payer_client_id, issue_date, membership_year, currency, amount, payment_type, payment_method, status, created_at, updated_at)
VALUES (${sql(`R${member.receiptYear}-${String(sequence).padStart(4, "0")}`)}, (SELECT id FROM clients WHERE client_code = ${sql(member.code)}), ${sql(`${member.receiptYear}-01-15`)}, ${member.receiptYear}, 'CAD', 20, 'Membership Fee', 'Cash', 'active', ${sql(nowDateTime)}, ${sql(nowDateTime)})`);
        sequence += 1;
    }
    return statements;
}

function attendanceInserts(): string[] {
    return attendancePlan.map(([groupIndex, memberIndex, daysAgo]) => {
        const group = interestGroups[groupIndex];
        const member = members[memberIndex];
        const date = daysAgo === 0 ? nowDate : businessDateDaysBefore(now, daysAgo);
        return `INSERT INTO attendance (interest_group_id, interest_group_name, client_id, client_code, attendance_date, attended_at, status, created_at, updated_at)
VALUES ((SELECT id FROM interest_groups WHERE name = ${sql(group.name)}), ${sql(group.name)}, (SELECT id FROM clients WHERE client_code = ${sql(member.code)}), ${sql(member.code)}, ${sql(date)}, ${sql(nowDateTime)}, 'active', ${sql(nowDateTime)}, ${sql(nowDateTime)})`;
    });
}

function fsiiInserts(): string[] {
    return fsiiSurveyMemberCodes.map((code, index) => `INSERT INTO fsii_survey_responses (client_id, survey_type, answered_date, questionnaire_version, answer_1, answer_2, answer_3, answer_4, answer_5, created_at)
VALUES ((SELECT id FROM clients WHERE client_code = ${sql(code)}), 'community_participation', ${sql(addBusinessDateDays(nowDate, -(index + 1)) ?? nowDate)}, 'seed-v1', 'Quite often', 'Occasionally', 'Rarely', 'Very often', 'Occasionally', ${sql(nowDateTime)})`);
}

const statements = [
    ...interestGroups.map((group) => `INSERT INTO interest_groups (name, status, created_at, updated_at) VALUES (${sql(group.name)}, 'active', ${sql(nowDateTime)}, ${sql(nowDateTime)})`),
    ...members.map(clientInsert),
    ...receiptInserts(),
    ...attendanceInserts(),
    ...fsiiInserts(),
];

const command = statements.join(";\n") + ";";
const wranglerBin = join(projectRoot, "node_modules", ".bin", "wrangler");
console.log(`Seeding local D1: ${interestGroups.length} interest groups, ${members.length} members, ${attendancePlan.length} attendance records, ${receiptInserts().length} receipts, ${fsiiSurveyMemberCodes.length} survey responses...`);
execFileSync(wranglerBin, ["d1", "execute", "DB", "--local", `--command=${command}`, "--persist-to", ".wrangler/state"], { stdio: "inherit", cwd: projectRoot });
console.log("Seed completed.");
