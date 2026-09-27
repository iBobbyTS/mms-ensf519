import type { PageServerLoad } from "./$types";

import * as m from "$lib/paraglide/messages";
import { getDb } from "$lib/server/db";
import { toMessageText } from "$lib/server/message";
import { listInterestGroups } from "$lib/server/domain";
import { consumePageFlash } from "$lib/server/page-flash";

export const load: PageServerLoad = async ({ cookies, platform }) => {
    const db = getDb(platform);
    const interestGroups = await listInterestGroups(db);
    const flash = consumePageFlash(cookies, "/interest-group/manage");
    const feedback =
        flash === "created"
            ? toMessageText(m.interestGroupCreated())
            : flash === "renamed"
                ? toMessageText(m.groupManagementRenamed())
            : flash === "deleted"
                    ? toMessageText(m.groupManagementDeleted())
                    : null;
    const errorMessage =
        flash === "fields-required"
            ? toMessageText(m.interestGroupNameRequired())
            : flash === "missing-id"
                ? toMessageText(m.groupManagementDeleteMissingCode())
                : null;

    return {
        interestGroups,
        feedback,
        errorMessage,
    };
};
