import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

import { loadDirectoryApiPage } from "$lib/server/directory-api";

export const GET: RequestHandler = async ({ url, platform }) => {
    return json({ data: await loadDirectoryApiPage("members", { url, platform }) });
};
