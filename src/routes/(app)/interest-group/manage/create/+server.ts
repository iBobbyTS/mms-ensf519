import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

import { getDb } from "$lib/server/db";
import { createInterestGroup } from "$lib/server/domain";
import { setPageFlash } from "$lib/server/page-flash";

export const POST: RequestHandler = async ({ cookies, request, platform, url }) => {
    const formData = await request.formData();
    const interestGroupName =
        formData.get("interestGroupName")?.toString().trim() ?? "";
    const manageRoute = "/interest-group/manage";

    if (!interestGroupName) {
        setPageFlash(cookies, { path: manageRoute, value: "fields-required", secure: url?.protocol === "https:" });
        throw redirect(303, manageRoute);
    }

    const db = getDb(platform);

    await createInterestGroup(db, {
        name: interestGroupName,
        defaultAttendanceDate: null,
    });

    setPageFlash(cookies, { path: manageRoute, value: "created", secure: url?.protocol === "https:" });
    throw redirect(303, manageRoute);
};
