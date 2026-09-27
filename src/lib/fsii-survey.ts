export const FSII_QUESTIONNAIRE_VERSION = "fsii-2026-v1";

export const FSII_SURVEY_TYPES = [
    "community_participation",
    "satisfaction",
] as const;
export type FsiiSurveyType = (typeof FSII_SURVEY_TYPES)[number];

export const COMMUNITY_PARTICIPATION_ANSWERS = [
    "Never, or almost never",
    "Rarely",
    "Occasionally",
    "Quite often",
    "Very often",
    "Always, or almost always",
] as const;
export const SATISFACTION_ANSWERS = [
    "Strongly disagree",
    "Disagree",
    "Neither",
    "Agree",
    "Strongly agree",
    "N/A",
] as const;

export const COMMUNITY_PARTICIPATION_QUESTIONS = [
    "My neighbours tell me their news or I tell them mine",
    "I chat with my neighbours",
    "I take an active part in organized group activities in my community",
    "I am an active member of at least one sporting, hobby or community-based club or association",
    "I attend events that bring people together such as parties, shows, festivals, or other community events",
] as const;
export const SATISFACTION_QUESTIONS = [
    "Overall, I am satisfied with this FCSS funded program/service.",
    "Overall, I found this program easy to access.",
] as const;

export function normalizeFsiiSurveyDate(value: string): string | null {
    const match = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) return null;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isCommunityAnswer(value: string): boolean {
    return (COMMUNITY_PARTICIPATION_ANSWERS as readonly string[]).includes(value);
}
export function isSatisfactionAnswer(value: string): boolean {
    return (SATISFACTION_ANSWERS as readonly string[]).includes(value);
}
