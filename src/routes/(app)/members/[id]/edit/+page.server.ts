import type { Actions, PageServerLoad } from "./$types";

import {
    loadClientDetailPage,
    updateClientActions,
} from "$lib/server/client-detail-page";

export const load: PageServerLoad = async ({ params, platform }) =>
    loadClientDetailPage(params, platform);

export const actions = updateClientActions satisfies Actions;
