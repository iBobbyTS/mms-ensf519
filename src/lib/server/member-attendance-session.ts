import {
    ATTENDANCE_CHECKOUT_AUTO_SECONDS,
    ATTENDANCE_DUPLICATE_REMINDER_SECONDS,
    isAttendanceRegisterAgainConfirmationRequired,
    resolveOpenAttendanceDuplicateAction,
    type AttendanceCheckResult,
} from "$lib/member-attendance";
import * as m from "$lib/paraglide/messages";

export type MemberAttendanceSessionClient = {
    chinese_name: string;
};

export type MemberAttendanceSessionDuplicate = {
    attended_at: string;
    checked_out_at: string | null;
};

export type MemberAttendanceSessionRegisterResult = {
    checkResult: AttendanceCheckResult;
    message: string;
    silent?: boolean;
    reminder?: {
        timeoutSeconds: number;
    };
    confirmation?: {
        action: "checkOut" | "registerAgain";
        timeoutSeconds?: number;
    };
    checkoutConfirmation?: {
        timeoutSeconds: number;
    };
};

export function resolveSessionAttendanceDuplicateResult(input: {
    duplicate: MemberAttendanceSessionDuplicate;
    client: MemberAttendanceSessionClient;
    timestamp: string;
    forceRegisterAgain?: boolean;
    checkoutConfirmationMessage: string;
}): MemberAttendanceSessionRegisterResult | "direct-checkout" | null {
    if (input.duplicate.checked_out_at) {
        if (
            !input.forceRegisterAgain &&
            isAttendanceRegisterAgainConfirmationRequired({
                checkedOutAt: input.duplicate.checked_out_at,
                now: input.timestamp,
            })
        ) {
            return {
                checkResult: "Duplicated",
                message: m.interestGroupRegisterAgainConfirmation({
                    name: input.client.chinese_name,
                }),
                confirmation: {
                    action: "registerAgain",
                },
            };
        }

        return null;
    }

    const duplicateAction = resolveOpenAttendanceDuplicateAction({
        attendedAt: input.duplicate.attended_at,
        now: input.timestamp,
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
                name: input.client.chinese_name,
            }),
            reminder: {
                timeoutSeconds: ATTENDANCE_DUPLICATE_REMINDER_SECONDS,
            },
        };
    }

    if (duplicateAction === "confirm-checkout") {
        return {
            checkResult: "Duplicated",
            message: input.checkoutConfirmationMessage,
            confirmation: {
                action: "checkOut",
                timeoutSeconds: ATTENDANCE_CHECKOUT_AUTO_SECONDS,
            },
            checkoutConfirmation: {
                timeoutSeconds: ATTENDANCE_CHECKOUT_AUTO_SECONDS,
            },
        };
    }

    return "direct-checkout";
}

export function buildSessionAttendanceSuccessResult(
    checkResult: "Success" | "Grace",
    client: MemberAttendanceSessionClient,
): MemberAttendanceSessionRegisterResult {
    if (checkResult === "Grace") {
        return {
            checkResult,
            message: m.attendanceGrace({ name: client.chinese_name }),
        };
    }

    return {
        checkResult,
        message: m.attendanceSuccess({ name: client.chinese_name }),
    };
}
