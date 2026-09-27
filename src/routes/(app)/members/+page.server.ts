import type { PageServerLoad } from "./$types";

import { loadClientDirectoryPage } from "$lib/server/client-pages";

export const load: PageServerLoad = async ({ platform }) => {
    return loadClientDirectoryPage(platform, {
        defaultClientType: "Member",
        lockClientType: true,
    });
};
