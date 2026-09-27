import type { AttendanceFeedbackTone } from "./member-attendance.ts";
import type { DropdownSearchItem } from "./dropdown-search.ts";

export type AttendanceRecord = {
    id: number;
    clientId: number | null;
    childMemberId: number | null;
    clientCode: string;
    chineseName: string;
    englishName: string | null;
    registeredAt?: string | null;
    attendedAt: string;
    checkedOutAt?: string | null;
    status: string;
    wasRegisteredWhenAttended?: boolean;
    latestFsiiSurveyDate?: string | null;
    fsiiSurveyCompletedThisYear?: boolean | null;
};

export type AttendanceCounterDefinition = {
    key: string;
    label: string;
    tone?: "primary" | "secondary" | "accent";
};

export type AttendanceFeedback = {
    tone: AttendanceFeedbackTone;
    message: string;
};

export type AttendanceConfirmation = {
    action: "checkOut" | "registerAgain";
    member: DropdownSearchItem;
    message: string;
    timeoutSeconds: number;
    secondsRemaining: number;
};

export type AttendanceReminder = {
    message: string;
    timeoutSeconds: number;
};
