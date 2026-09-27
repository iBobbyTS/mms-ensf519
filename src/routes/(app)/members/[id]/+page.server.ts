import type { PageServerLoad } from "./$types";

import { loadClientDetailPage } from "$lib/server/client-detail-page";
import { consumePageFlash } from "$lib/server/page-flash";

export const load: PageServerLoad = async ({ cookies, params, platform }) => {
    const detail = await loadClientDetailPage(params, platform);
    const flash = consumePageFlash(cookies, `/members/${params.id}`);
    return { ...detail, flash };
};
