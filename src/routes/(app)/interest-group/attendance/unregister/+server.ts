import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

import * as m from "$lib/paraglide/messages";
import { getDb } from "$lib/server/db";
import {
    getInterestGroupAttendanceSnapshot,
    unregisterInterestGroupAttendance,
} from "$lib/server/domain";

export const POST: RequestHandler = async ({ request, platform }) => {
    const db = getDb(platform);
    const body = (await request.json()) as {
        interest_group_id?: number | string;
        attendance_id?: number | string;
        client_code?: string;
    };
    const interestGroupId = Number(body.interest_group_id ?? "");
    const attendanceId = Number(body.attendance_id ?? "");
    const clientCode = body.client_code?.trim() ?? "";
    const hasAttendanceId = Number.isInteger(attendanceId) && attendanceId > 0;

    if (
        !Number.isInteger(interestGroupId) ||
        interestGroupId <= 0 ||
        (!hasAttendanceId && !clientCode)
    ) {
        return json(
            {
                success: false,
                message: m.interestGroupAttendanceRequired(),
                records: [],
                counters: { todayTotal: 0, monthTotal: 0 },
            },
            { status: 400 },
        );
    }

    const result = await unregisterInterestGroupAttendance(db, {
        interestGroupId,
        attendanceId: hasAttendanceId ? attendanceId : undefined,
        clientCode: clientCode || undefined,
    });
    const snapshot = await getInterestGroupAttendanceSnapshot(db, interestGroupId);

    return json(
        {
            success: result.success,
            message: result.message,
            records: snapshot.records,
            counters: snapshot.counters,
        },
        { status: result.reason === "undo_expired" ? 403 : 200 },
    );
};
