import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

import * as m from "$lib/paraglide/messages";
import {
    getAttendanceFeedbackTone,
    isAttendanceSuccessfulCheckResult,
} from "$lib/member-attendance";
import { getDb } from "$lib/server/db";
import {
    getInterestGroupAttendanceSnapshot,
    registerInterestGroupAttendance,
} from "$lib/server/domain";

export const POST: RequestHandler = async ({ request, platform }) => {
    const db = getDb(platform);
    const body = (await request.json()) as {
        interest_group_id?: number | string;
        client_code?: string;
    };
    const interestGroupId = Number(body.interest_group_id ?? "");
    const clientCode = body.client_code?.trim() ?? "";

    if (!Number.isInteger(interestGroupId) || interestGroupId <= 0 || !clientCode) {
        return json(
            {
                success: false,
                message: m.interestGroupAttendanceRequired(),
                checkResult: "Invalid",
                feedbackTone: "error",
                records: [],
                counters: { todayTotal: 0, monthTotal: 0 },
            },
            { status: 400 },
        );
    }

    const result = await registerInterestGroupAttendance(db, {
        interestGroupId,
        clientCode,
        dataSource: "SvelteKit",
    });
    const snapshot = await getInterestGroupAttendanceSnapshot(db, interestGroupId);

    return json({
        success: isAttendanceSuccessfulCheckResult(result.checkResult),
        message: result.message,
        checkResult: result.checkResult,
        feedbackTone: getAttendanceFeedbackTone(result.checkResult),
        silent: result.silent,
        reminder: result.reminder
            ? {
                  message: result.message,
                  timeoutSeconds: result.reminder.timeoutSeconds,
              }
            : undefined,
        records: snapshot.records,
        counters: snapshot.counters,
    });
};
