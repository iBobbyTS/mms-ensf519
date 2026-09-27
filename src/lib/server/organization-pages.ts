import { fail, redirect, type Cookies } from "@sveltejs/kit";

import {
    resolveClientDirectoryPageSize,
} from "$lib/client-directory";
import * as m from "$lib/paraglide/messages";
import { getDb } from "$lib/server/db";
import {
    createOrganization,
    listOrganizations,
    parseOrganizationFormData,
} from "$lib/server/domain";
import { setPageFlash } from "$lib/server/page-flash";
import { isValidCanadianPostalCode } from "$lib/postal-code";
import { isValidEmail } from "$lib/email";

export async function loadOrganizationDirectoryPage(
    platform: App.Platform | undefined,
    query?: { search: string; page: number; limit: number },
) {
    const db = getDb(platform);
    const search = query?.search ?? "";
    const page = query?.page ?? 1;
    const limit = query?.limit ?? resolveClientDirectoryPageSize();

    const { rows, total } = await listOrganizations(db, {
        search,
        page,
        limit,
    });

    return {
        organizations: rows,
        total,
        page,
        limit,
        search,
    };
}

function validateOrganizationInput(input: ReturnType<typeof parseOrganizationFormData>) {
    if (!input.chineseName) {
        return m.organizationChineseNameRequired();
    }
    if (!input.englishName) {
        return m.organizationEnglishNameRequired();
    }
    if (!isValidCanadianPostalCode(input.postalCode)) {
        return m.postalCodeInvalid();
    }
    if (!isValidEmail(input.email) || input.contacts.some((contact) => !isValidEmail(contact.email))) {
        return m.emailInvalid();
    }
    for (const contact of input.contacts) {
        if (!contact.chineseName || !contact.englishName) {
            return m.organizationContactNameRequired();
        }
    }

    return null;
}

export const createOrganizationActions = {
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
        const input = parseOrganizationFormData(await request.formData());
        const validationError = validateOrganizationInput(input);
        if (validationError) {
            return fail(400, { error: validationError });
        }

        let organizationCode: string;

        try {
            organizationCode = await createOrganization(getDb(platform), input);
        } catch (cause) {
            if (cause instanceof Response) throw cause;
            console.error("机构创建流程失败:", cause);
            return fail(500, { error: m.organizationCreateFailed() });
        }

        const detailPath = `/organizations/${organizationCode}`;
        setPageFlash(cookies, {
            path: detailPath,
            value: "created",
            secure: url.protocol === "https:",
        });
        throw redirect(303, detailPath);
    },
};
