import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

import { clampDropdownSearchLimit } from "@ibobbyts/svelte-ui-utils/dropdown-search/state";
import { getDb } from "$lib/server/db";
import { searchActiveMembers } from "$lib/server/domain";

function parseRequestedFields(url: URL): string[] {
    return url.searchParams
        .getAll("fields")
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean);
}

function resolveSearchPolicy(url: URL): { clientType: string; includeLegalName: boolean } {
    const requestedClientType = url.searchParams.get("clientType")?.trim();
    const clientType =
        requestedClientType === "Member" ||
        requestedClientType === "participant" ||
        requestedClientType === "child_member" ||
        requestedClientType === "Child Member"
            ? requestedClientType
            : "participant";
    return {
        clientType,
        includeLegalName: new Set(parseRequestedFields(url)).has("legalName"),
    };
}

export const GET: RequestHandler = async ({ platform, url }) => {
    const query = url.searchParams.get("q")?.trim() ?? "";
    const limit = clampDropdownSearchLimit(
        Number(url.searchParams.get("limit") ?? "10"),
    );
    const searchPolicy = resolveSearchPolicy(url);

    if (!query) {
        return json({ options: [], exactMatch: null, exactMatchCount: 0 });
    }

    const result = await searchActiveMembers(
        getDb(platform),
        query,
        limit,
        searchPolicy.clientType,
        { includeLegalName: searchPolicy.includeLegalName },
    );
    return json(result);
};
