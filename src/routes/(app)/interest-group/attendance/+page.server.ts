import type { PageServerLoad } from "./$types";

import { resolveInterestGroupAttendanceSelection } from "$lib/interest-group-attendance";
import { getDb } from "$lib/server/db";
import {
    getInterestGroupAttendanceSnapshot,
    listInterestGroups,
} from "$lib/server/domain";

export const load: PageServerLoad = async ({ platform }) => {
    const db = getDb(platform);
    const interestGroups = await listInterestGroups(db);
    const selection = resolveInterestGroupAttendanceSelection({
        interestGroups,
        requestedInterestGroupId: null,
    });
    const snapshot = selection.interestGroupId
        ? await getInterestGroupAttendanceSnapshot(db, selection.interestGroupId)
        : {
            records: [],
            counters: {
                todayTotal: 0,
                monthTotal: 0,
            },
        };

    return {
        interestGroups,
        interestGroupId: selection.interestGroupId,
        records: snapshot.records,
        counters: snapshot.counters,
    };
};
