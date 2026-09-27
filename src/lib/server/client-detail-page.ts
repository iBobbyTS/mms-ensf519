import { error, fail, redirect, type Cookies } from "@sveltejs/kit";
import { getMembershipState } from "$lib/membership-year-status";
import * as m from "$lib/paraglide/messages";
import { getDb, nowSqlDate } from "$lib/server/db";
import {
    getClientByCode,
    DomainValidationError,
    getClientLastMembershipYear,
    parseClientFormData,
    updateClient,
} from "$lib/server/domain";
import { toMessageText } from "$lib/server/message";
import { setPageFlash } from "$lib/server/page-flash";

type ClientDetailParams = {
    id: string;
};

export async function loadClientDetailPage(
    params: ClientDetailParams,
    platform: App.Platform | undefined,
) {
    const db = getDb(platform);
    const client = await getClientByCode(db, params.id);

    if (!client) {
        throw error(404, toMessageText(m.clientNotFound()));
    }

    const lastMembershipYear = await getClientLastMembershipYear(db, client.id);
    const membershipState = getMembershipState({
        clientType: client.clientType,
        membershipType: client.membershipType,
        lastMembershipYear,
        currentYear: Number(nowSqlDate().slice(0, 4)),
    });

    return {
        client,
        membershipState,
    };
}

export const updateClientActions = {
    update: async ({
        request,
        platform,
        params,
        cookies,
        url,
    }: {
        request: Request;
        locals: App.Locals;
        platform: App.Platform | undefined;
        params: ClientDetailParams;
        cookies: Cookies;
        url: URL;
    }) => {
        const formData = await request.formData();
        const input = parseClientFormData(formData);

        try {
            await updateClient(getDb(platform), params.id, input, {
                allowMissingRequired: true,
            });
        } catch (cause) {
            if (cause instanceof DomainValidationError) {
                return fail(400, { error: toMessageText(cause.message) });
            }
            console.error("Failed to update client profile:", cause);
            return fail(500, { error: toMessageText(m.clientUpdateFailed()) });
        }

        const detailPath = `/members/${params.id}`;
        setPageFlash(cookies, {
            path: detailPath,
            value: "updated",
            secure: url.protocol === "https:",
        });
        throw redirect(303, detailPath);
    },
};
