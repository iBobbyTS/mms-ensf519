import {
    isClientDirectoryPageSize,
    resolveClientDirectoryPageSize,
    resolveClientDirectorySort,
} from "$lib/client-directory";
import { resolveDirectoryPageQuery } from "$lib/directory-page-state";
import { parseMstatParam } from "$lib/membership-status-filter";
import { loadChildMemberDirectoryPage } from "$lib/server/child-member-pages";
import { loadClientDirectoryPage } from "$lib/server/client-pages";
import { loadOrganizationDirectoryPage } from "$lib/server/organization-pages";
import { loadTemporaryParticipantDirectoryPage } from "$lib/server/temporary-participant-pages";
import { resolveTemporaryParticipantDirectorySort } from "$lib/temporary-participant-directory";

export type DirectoryApiKind =
    | "members"
    | "child-members"
    | "organizations"
    | "temporary-participants";

type DirectoryApiContext = {
    url: URL;
    platform: App.Platform | undefined;
};

export async function loadDirectoryApiPage(
    kind: DirectoryApiKind,
    { url, platform }: DirectoryApiContext,
) {
    const { search, page, limitParam } = resolveDirectoryPageQuery(url);
    const requestedLimit = Number(limitParam);
    const limit = isClientDirectoryPageSize(requestedLimit)
        ? requestedLimit
        : resolveClientDirectoryPageSize();

    switch (kind) {
        case "members":
            return loadClientDirectoryPage(platform, {
                defaultClientType: "Member",
                lockClientType: true,
                query: {
                    search,
                    page,
                    limit,
                    membershipStatus: parseMstatParam(url.searchParams.get("mstat")),
                    sort: resolveClientDirectorySort({
                        sort: url.searchParams.get("sort"),
                        dir: url.searchParams.get("dir"),
                    }),
                },
            });
        case "child-members":
            return loadChildMemberDirectoryPage(platform, {
                search,
                page,
                limit,
                membershipStatus: parseMstatParam(url.searchParams.get("mstat")),
                sort: resolveClientDirectorySort({
                    sort: url.searchParams.get("sort"),
                    dir: url.searchParams.get("dir"),
                }),
            });
        case "organizations":
            return loadOrganizationDirectoryPage(platform, { search, page, limit });
        case "temporary-participants":
            return loadTemporaryParticipantDirectoryPage(platform, {
                search,
                page,
                limit,
                sort: resolveTemporaryParticipantDirectorySort({
                    sort: url.searchParams.get("sort"),
                    dir: url.searchParams.get("dir"),
                }),
            });
    }
}
