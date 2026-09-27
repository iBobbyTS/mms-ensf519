import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import {
    buildDirectoryQuery,
    buildDirectoryQueryKey,
    committedDirectoryControls,
    createDirectoryRequestCoordinator,
    createSearchDebounce,
    resolveDirectoryPageQuery,
} from "./directory-page-state.ts";

const root = new URL("../../", import.meta.url);

register(
    `data:text/javascript,${encodeURIComponent(`
        import { existsSync, statSync } from "node:fs";
        import { fileURLToPath, pathToFileURL } from "node:url";
        const libRootUrl = ${JSON.stringify(new URL("./", import.meta.url).href)};
        export function resolve(specifier, context, nextResolve) {
            if (specifier.startsWith("$lib/")) {
                const path = fileURLToPath(new URL(specifier.slice(5), libRootUrl));
                for (const suffix of [".ts", ".js", "/index.ts", "/index.js", ""]) {
                    if (existsSync(path + suffix) && statSync(path + suffix).isFile()) {
                        return nextResolve(pathToFileURL(path + suffix).href, context);
                    }
                }
            }
            return nextResolve(specifier, context);
        }
    `)}`,
    import.meta.url,
);

function read(path: string): string {
    return readFileSync(new URL(path, root), "utf8");
}

function functionSource(source: string, name: string): string {
    const start = source.indexOf(`function ${name}`);
    assert.notEqual(start, -1, `${name} must remain present`);
    const next = source.slice(start + 1).search(/\n    (?:async )?function /);
    return source.slice(start, next === -1 ? source.length : start + 1 + next);
}

type DirectorySnapshot = {
    search: string;
    page: number;
    limit: number;
    sort: string | null;
    dir: string;
    membershipStatus?: string[];
    rows: string[];
};

type DirectoryResponse = {
    ok: boolean;
    status: number;
    json(): Promise<{ data: DirectorySnapshot }>;
};

type DirectoryFetch = (
    url: string,
    init: { signal: AbortSignal },
) => Promise<DirectoryResponse>;

type DirectoryRefreshOverrides = {
    q?: string;
    page?: number;
    limit?: number;
    membershipStatus?: string[];
    sort?: string | null;
    dir?: string;
};

/**
 * A small executable model of the request boundary used by each directory page.
 * It deliberately uses the production query builder and request coordinator;
 * source-contract assertions below prove that each Svelte page wires this
 * boundary to its own endpoint and lifecycle callbacks.
 */
function createRequestHarness(
    endpoint: string,
    initial: DirectorySnapshot,
    fetchDirectory: DirectoryFetch,
) {
    const coordinator = createDirectoryRequestCoordinator();
    let committed = initial;
    let controls = {
        search: initial.search,
        membershipStatus: initial.membershipStatus,
        sort: initial.sort,
        dir: initial.dir,
    };
    let retryOverrides: DirectoryRefreshOverrides | null = null;
    let error: string | null = null;
    let loading = false;
    const requests: Array<{ url: string; signal: AbortSignal }> = [];

    function query(overrides: DirectoryRefreshOverrides = {}) {
        return buildDirectoryQuery(
            {
                search: controls.search,
                page: committed.page,
                limit: committed.limit,
                sort: controls.sort,
                dir: controls.dir,
            },
            overrides,
            {
                membershipStatus: controls.membershipStatus,
                serializeMembershipStatus: (value) =>
                    Array.isArray(value) ? value.join(",") : null,
            },
        );
    }

    async function refresh(overrides: DirectoryRefreshOverrides = {}) {
        const { controller, sequence } = coordinator.start();
        const requestOverrides: DirectoryRefreshOverrides = {
            q: overrides.q ?? controls.search,
            page: overrides.page ?? committed.page,
            limit: overrides.limit ?? committed.limit,
            membershipStatus:
                overrides.membershipStatus ?? controls.membershipStatus,
            sort:
                overrides.sort !== undefined ? overrides.sort : controls.sort,
            dir: overrides.dir ?? controls.dir,
        };
        retryOverrides = requestOverrides;
        loading = true;
        error = null;
        const url = `${endpoint}?${query(requestOverrides)}`;
        requests.push({ url, signal: controller.signal });
        try {
            const response = await fetchDirectory(url, { signal: controller.signal });
            if (!response.ok) throw new Error(`Directory request failed (${response.status})`);
            const result = await response.json();
            if (!coordinator.isCurrent(sequence)) return;
            committed = result.data;
            controls = {
                search: committed.search,
                membershipStatus: committed.membershipStatus,
                sort: committed.sort,
                dir: committed.dir,
            };
            retryOverrides = null;
        } catch (cause) {
            if (cause instanceof DOMException && cause.name === "AbortError") return;
            if (!coordinator.isCurrent(sequence)) return;
            error = "network request failed";
            controls = {
                search: committed.search,
                membershipStatus: committed.membershipStatus,
                sort: committed.sort,
                dir: committed.dir,
            };
            throw cause;
        } finally {
            if (coordinator.isCurrent(sequence)) {
                loading = false;
                coordinator.complete(sequence);
            }
        }
    }

    return {
        refresh,
        submit(overrides: DirectoryRefreshOverrides) {
            if (overrides.q !== undefined) controls.search = overrides.q;
            if (overrides.membershipStatus !== undefined) {
                controls.membershipStatus = overrides.membershipStatus;
            }
            if (overrides.sort !== undefined) controls.sort = overrides.sort;
            if (overrides.dir !== undefined) controls.dir = overrides.dir;
        },
        retry() {
            return retryOverrides ? refresh(retryOverrides) : Promise.resolve();
        },
        teardown() {
            coordinator.teardown();
        },
        requests,
        get state() {
            return { committed, controls, retryOverrides, error, loading };
        },
    };
}

function response(data: DirectorySnapshot, status = 200): DirectoryResponse {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => ({ data }),
    };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((nextResolve, nextReject) => {
        resolve = nextResolve;
        reject = nextReject;
    });
    return { promise, resolve, reject };
}

function emptyD1(): D1Database {
    const statement = {
        bind() {
            return this;
        },
        all: async () => ({ results: [], success: true, meta: {} }),
        first: async () => null,
        run: async () => ({ success: true, meta: {} }),
        raw: async () => [],
    };
    return {
        prepare() {
            return statement;
        },
        batch: async () => [],
    } as unknown as D1Database;
}

test("directory API query resolution preserves endpoint transport controls", () => {
    const staleUrl = new URL(
        "https://example.test/members?q=stale&page=9&limit=50&mstat=expired&sort=client_code&dir=asc",
    );
    assert.deepEqual(resolveDirectoryPageQuery(staleUrl), {
        search: "stale",
        page: 9,
        limitParam: "50",
    });
});

test("filtered and sortable directory retries capture the complete failed query identity", () => {
    const contracts = [
        ["ClientDirectoryPage.svelte", ["q", "page", "limit", "membershipStatus", "sort", "dir"]],
    ] as const;

    for (const [file, fields] of contracts) {
        const source = read(`src/lib/components/${file}`);
        const refresh = functionSource(source, "refreshDirectory");
        const retry = functionSource(source, "retryDirectory");
        for (const field of fields) {
            assert.match(refresh, new RegExp(`\\b${field}:`), `${file} must snapshot ${field}`);
        }
        assert.match(refresh, /retryOverrides\s*=\s*requestOverrides/);
        assert.match(retry, /currentDirectoryQueryKey\(overrides\)/);
    }
});

test("directory loading is owned by the shared page as a floating status", () => {
    const source = read("src/lib/components/DirectoryPage.svelte");
    assert.match(source, /loading = false/);
    assert.match(source, /fixed inset-x-0 top-\[calc\(var\(--app-navbar-height\)\+0\.75rem\)\]/);
    assert.match(source, /role="status"/);
    assert.match(source, /m\.directoryLoading\(\)/);

    for (const file of [
        "ClientDirectoryPage.svelte",
    ]) {
        const page = read(`src/lib/components/${file}`);
        assert.match(page, /loading=\{requestLoading\}/);
        assert.doesNotMatch(page, /loading-spinner loading-sm/);
    }
});

test("request harness sends latest query and ignores stale responses", async () => {
    const first = deferred<DirectoryResponse>();
    const second = deferred<DirectoryResponse>();
    const pending: Array<ReturnType<typeof deferred<DirectoryResponse>>> = [first, second];
    const harness = createRequestHarness(
        "/api/members/directory",
        { search: "", page: 1, limit: 20, sort: null, dir: "desc", membershipStatus: ["active"], rows: ["old"] },
        async (_url, _init) => pending.shift()!.promise,
    );

    const firstRequest = harness.refresh({ q: "alice", page: 1 });
    const secondRequest = harness.refresh({ q: "alice", page: 3, sort: "client_code", dir: "asc" });
    assert.match(harness.requests[1].url, /q=alice/);
    assert.match(harness.requests[1].url, /page=3/);
    assert.match(harness.requests[1].url, /sort=client_code/);
    second.resolve(response({ search: "alice", page: 3, limit: 20, sort: "client_code", dir: "asc", membershipStatus: ["active"], rows: ["new"] }));
    await secondRequest;
    first.resolve(response({ search: "alice", page: 1, limit: 20, sort: null, dir: "desc", membershipStatus: ["active"], rows: ["stale"] }));
    await firstRequest;
    assert.deepEqual(harness.state.committed.rows, ["new"]);
    assert.equal(harness.requests[0].signal.aborted, true);
});

test("failed refresh restores committed controls and retry resubmits the failed query", async () => {
    let attempt = 0;
    const harness = createRequestHarness(
        "/api/organizations/directory",
        { search: "committed", page: 2, limit: 20, sort: null, dir: "desc", rows: ["old"] },
        async (_url, _init) => {
            attempt += 1;
            return attempt === 1
                ? response({ search: "committed", page: 2, limit: 20, sort: null, dir: "desc", rows: ["old"] }, 503)
                : response({ search: "next", page: 1, limit: 20, sort: null, dir: "desc", rows: ["new"] });
        },
    );
    await assert.rejects(harness.refresh({ q: "next", page: 1 }));
    assert.equal(harness.state.error, "network request failed");
    assert.equal(harness.state.controls.search, "committed");
    assert.match(harness.requests[0].url, /q=next/);
    await harness.retry();
    assert.equal(attempt, 2);
    assert.match(harness.requests[1].url, /q=next/);
    assert.deepEqual(harness.state.committed.rows, ["new"]);
});

test("sorting and membership filter failures retry the exact failed query snapshot", async () => {
    const scenarios = [
        {
            endpoint: "/api/members/directory",
            initialMembershipStatus: ["active"],
            failedControls: {
                membershipStatus: ["expired"],
                sort: "membership_status",
                dir: "asc",
            },
        },
        {
            endpoint: "/api/child-members/directory",
            initialMembershipStatus: ["active", "warning"],
            failedControls: {
                membershipStatus: ["lifetime"],
                sort: "client_code",
                dir: "desc",
            },
        },
        {
            endpoint: "/api/temporary-participants/directory",
            initialMembershipStatus: undefined,
            failedControls: {
                membershipStatus: undefined,
                sort: "participantCode",
                dir: "asc",
            },
        },
    ] as const;

    for (const scenario of scenarios) {
        let attempt = 0;
        const successfulSnapshot: DirectorySnapshot = {
            search: "next",
            page: 1,
            limit: 20,
            sort: scenario.failedControls.sort,
            dir: scenario.failedControls.dir,
            membershipStatus: scenario.failedControls.membershipStatus
                ? [...scenario.failedControls.membershipStatus]
                : undefined,
            rows: ["new"],
        };
        const harness = createRequestHarness(
            scenario.endpoint,
            {
                search: "committed",
                page: 4,
                limit: 20,
                sort: null,
                dir: "desc",
                membershipStatus: scenario.initialMembershipStatus
                    ? [...scenario.initialMembershipStatus]
                    : undefined,
                rows: ["old"],
            },
            async () => {
                attempt += 1;
                return attempt === 1
                    ? response(successfulSnapshot, 503)
                    : response(successfulSnapshot);
            },
        );

        harness.submit({
            q: "next",
            membershipStatus: scenario.failedControls.membershipStatus
                ? [...scenario.failedControls.membershipStatus]
                : undefined,
            sort: scenario.failedControls.sort,
            dir: scenario.failedControls.dir,
        });
        await assert.rejects(harness.refresh({ page: 1, limit: 20 }));

        assert.deepEqual(harness.state.retryOverrides, {
            q: "next",
            page: 1,
            limit: 20,
            membershipStatus: scenario.failedControls.membershipStatus
                ? [...scenario.failedControls.membershipStatus]
                : undefined,
            sort: scenario.failedControls.sort,
            dir: scenario.failedControls.dir,
        });
        const failedUrl = new URL(harness.requests[0].url, "https://example.test");
        assert.equal(failedUrl.searchParams.get("q"), "next");
        assert.equal(failedUrl.searchParams.get("page"), "1");
        assert.equal(failedUrl.searchParams.get("limit"), "20");
        assert.equal(failedUrl.searchParams.get("sort"), scenario.failedControls.sort);
        assert.equal(failedUrl.searchParams.get("dir"), scenario.failedControls.dir);
        assert.equal(
            failedUrl.searchParams.get("mstat"),
            scenario.failedControls.membershipStatus?.join(",") ?? null,
        );

        await harness.retry();
        assert.equal(harness.requests[1].url, harness.requests[0].url);
        assert.deepEqual(harness.state.committed.rows, ["new"]);
    }
});

test("teardown aborts and rejects a late response from committing", async () => {
    const pending = deferred<DirectoryResponse>();
    const harness = createRequestHarness(
        "/api/temporary-participants/directory",
        { search: "committed", page: 1, limit: 20, sort: null, dir: "desc", rows: ["old"] },
        async (_url, _init) => pending.promise,
    );
    const request = harness.refresh({ q: "late" });
    harness.teardown();
    pending.resolve(response({ search: "late", page: 1, limit: 20, sort: null, dir: "desc", rows: ["late"] }));
    await request;
    assert.equal(harness.requests[0].signal.aborted, true);
    assert.deepEqual(harness.state.committed.rows, ["old"]);
    assert.equal(harness.state.loading, true);
});
