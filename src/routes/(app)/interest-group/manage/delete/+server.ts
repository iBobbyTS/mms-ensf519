import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

import { getDb } from "$lib/server/db";
import { deleteInterestGroup } from "$lib/server/domain";
import { setPageFlash } from "$lib/server/page-flash";

export const POST: RequestHandler = async ({ cookies, request, platform, url }) => {
    const formData = await request.formData();
    const interestGroupId = Number(
        formData.get("interestGroupId")?.toString().trim() ?? "",
    );
    const manageRoute = "/interest-group/manage";

    if (!Number.isInteger(interestGroupId) || interestGroupId <= 0) {
        setPageFlash(cookies, { path: manageRoute, value: "missing-id", secure: url?.protocol === "https:" });
        throw redirect(303, manageRoute);
    }

    await deleteInterestGroup(getDb(platform), interestGroupId);

    setPageFlash(cookies, { path: manageRoute, value: "deleted", secure: url?.protocol === "https:" });
    throw redirect(303, manageRoute);
};
