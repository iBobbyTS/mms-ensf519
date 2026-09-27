import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

import { getDb } from "$lib/server/db";
import { renameInterestGroup } from "$lib/server/domain";
import { setPageFlash } from "$lib/server/page-flash";

export const POST: RequestHandler = async ({ cookies, request, platform, url }) => {
    const formData = await request.formData();
    const interestGroupId = Number(
        formData.get("interestGroupId")?.toString().trim() ?? "",
    );
    const interestGroupName =
        formData.get("interestGroupName")?.toString().trim() ?? "";
    const manageRoute = "/interest-group/manage";

    if (
        !Number.isInteger(interestGroupId) ||
        interestGroupId <= 0 ||
        !interestGroupName
    ) {
        setPageFlash(cookies, { path: manageRoute, value: "fields-required", secure: url?.protocol === "https:" });
        throw redirect(303, manageRoute);
    }

    await renameInterestGroup(getDb(platform), {
        interestGroupId,
        name: interestGroupName,
    });

    setPageFlash(cookies, { path: manageRoute, value: "renamed", secure: url?.protocol === "https:" });
    throw redirect(303, manageRoute);
};
