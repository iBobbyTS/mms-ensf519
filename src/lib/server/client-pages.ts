import { fail, redirect, type Cookies } from "@sveltejs/kit";

import {
    resolveClientDirectoryPageSize,
    resolveClientDirectorySort,
    type ClientDirectorySort,
} from "$lib/client-directory";
import {
    parseMstatParam,
    showMembershipStatusFilterInDirectory,
    type MembershipStatusFilter,
} from "$lib/membership-status-filter";
import * as m from "$lib/paraglide/messages";
import { getDb } from "$lib/server/db";
import {
    createClient,
    DomainValidationError,
    listClients,
    parseClientFormData,
} from "$lib/server/domain";
import { toMessageText } from "$lib/server/message";
import { setPageFlash } from "$lib/server/page-flash";

type DirectoryOptions = {
    defaultClientType?: string;
    lockClientType?: boolean;
    query?: {
        search: string;
        page: number;
        limit: number;
        membershipStatus: MembershipStatusFilter;
        sort: ClientDirectorySort;
    };
};

export async function loadClientDirectoryPage(
    platform: App.Platform | undefined,
    { defaultClientType = "Member", lockClientType = true, query }: DirectoryOptions = {},
) {
    const db = getDb(platform);
    const clientType = defaultClientType || "Member";
    const search = query?.search ?? "";
    const page = query?.page ?? 1;
    const limit = query?.limit ?? resolveClientDirectoryPageSize();
    const membershipStatus = query?.membershipStatus ?? parseMstatParam(null);
    const sort = query?.sort ?? resolveClientDirectorySort({ sort: null, dir: null });

    const { rows, total } = await listClients(db, {
        search,
        clientType,
        page,
        limit,
        membershipStatus,
        sort,
    });

    return {
        members: rows,
        total,
        page,
        limit,
        search,
        clientType,
        lockClientType,
        membershipStatus,
        sort,
        showMembershipStatusFilter: showMembershipStatusFilterInDirectory({
            lockClientType,
            clientType,
        }),
    };
}

export const createClientActions = {
    default: async ({
        request,
        locals,
        platform,
        cookies,
        url,
    }: {
        request: Request;
        locals: App.Locals;
        platform: App.Platform | undefined;
        cookies: Cookies;
        url: URL;
    }) => {
        const input = parseClientFormData(await request.formData());

        let clientCode: string;

        try {
            clientCode = await createClient(getDb(platform), input, {
                allowMissingRequired: true,
            });
        } catch (cause) {
            if (cause instanceof Response) throw cause;
            if (cause instanceof DomainValidationError) {
                return fail(400, { error: toMessageText(cause.message) });
            }
            console.error("客户创建流程失败:", cause);
            return fail(500, { error: m.clientCreateFailed() });
        }

        const detailPath = `/members/${clientCode}`;
        setPageFlash(cookies, {
            path: detailPath,
            value: "created",
            secure: url.protocol === "https:",
        });
        throw redirect(303, detailPath);
    },
};
