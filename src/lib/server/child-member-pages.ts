import { fail, redirect, type Cookies } from "@sveltejs/kit";

import {
    resolveClientDirectoryPageSize,
    resolveClientDirectorySort,
    type ClientDirectorySort,
} from "$lib/client-directory";
import {
    parseMstatParam,
    type MembershipStatusFilter,
} from "$lib/membership-status-filter";
import * as m from "$lib/paraglide/messages";
import { getDb } from "$lib/server/db";
import {
    createChildMember,
    DomainValidationError,
    listChildMembers,
    parseChildMemberFormData,
} from "$lib/server/domain";
import { toMessageText } from "$lib/server/message";
import { setPageFlash } from "$lib/server/page-flash";

export async function loadChildMemberDirectoryPage(
    platform: App.Platform | undefined,
    query?: {
        search: string;
        page: number;
        limit: number;
        membershipStatus: MembershipStatusFilter;
        sort: ClientDirectorySort;
    },
) {
    const db = getDb(platform);
    const search = query?.search ?? "";
    const page = query?.page ?? 1;
    const limit = query?.limit ?? resolveClientDirectoryPageSize();
    const membershipStatus = query?.membershipStatus ?? parseMstatParam(null);
    const sort = query?.sort ?? resolveClientDirectorySort({ sort: null, dir: null });

    const { rows, total } = await listChildMembers(db, {
        search,
        page,
        limit,
        membershipStatus,
        sort,
    });

    return {
        childMembers: rows,
        total,
        page,
        limit,
        search,
        membershipStatus,
        sort,
    };
}

export const createChildMemberActions = {
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
        const input = parseChildMemberFormData(await request.formData());

        if (!input.chineseName) {
            return fail(400, { error: m.childMemberChineseNameRequired() });
        }
        if (!input.firstName || !input.lastName) {
            return fail(400, { error: m.childMemberLegalNameRequired() });
        }

        let childCode: string;

        try {
            childCode = await createChildMember(getDb(platform), input);
        } catch (cause) {
            if (cause instanceof Response) throw cause;
            if (cause instanceof DomainValidationError) {
                return fail(400, { error: toMessageText(cause.message) });
            }
            console.error("儿童会员创建流程失败:", cause);
            return fail(500, { error: m.childMemberCreateFailed() });
        }

        const detailPath = `/child-members/${childCode}`;
        setPageFlash(cookies, {
            path: detailPath,
            value: "created",
            secure: url.protocol === "https:",
        });
        throw redirect(303, detailPath);
    },
};
