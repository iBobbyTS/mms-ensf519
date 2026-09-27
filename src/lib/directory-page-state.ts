export type DirectoryQueryState = {
    search: string;
    page: number;
    limit: number;
    sort?: string | null;
    dir?: string;
};

export type DirectoryQueryOverrides = {
    q?: string;
    page?: number;
    limit?: number;
    membershipStatus?: unknown;
    sort?: string | null;
    dir?: string;
};

export type DirectoryQueryOptions = {
    membershipStatus?: unknown;
    serializeMembershipStatus?: (value: unknown) => string | null;
};

export function resolveDirectoryPageQuery(url: URL) {
    return {
        search: url.searchParams.get("q") ?? "",
        page: Number(url.searchParams.get("page") ?? "1") || 1,
        limitParam: url.searchParams.get("limit"),
    };
}

export function committedDirectoryControls<T extends { search: string; membershipStatus?: unknown }>(data: T) {
    return {
        search: data.search,
        membershipStatus: data.membershipStatus,
    };
}

export function buildDirectoryQuery(
    state: DirectoryQueryState,
    overrides: Omit<DirectoryQueryOverrides, "search"> = {},
    options: DirectoryQueryOptions = {},
): string {
    const params = new URLSearchParams();
    const q = overrides.q !== undefined ? overrides.q : state.search;
    if (q) params.set("q", q);
    params.set("page", String(overrides.page !== undefined ? overrides.page : state.page));
    params.set("limit", String(overrides.limit !== undefined ? overrides.limit : state.limit));

    if (options.serializeMembershipStatus) {
        const status =
            overrides.membershipStatus !== undefined
                ? overrides.membershipStatus
                : options.membershipStatus;
        const serialized = options.serializeMembershipStatus(status);
        if (serialized) params.set("mstat", serialized);
    }

    const sort = overrides.sort !== undefined ? overrides.sort : state.sort;
    const dir = overrides.dir !== undefined ? overrides.dir : state.dir;
    if (sort) {
        params.set("sort", sort);
        if (dir) params.set("dir", dir);
    }

    return params.toString();
}

export function buildDirectoryQueryKey(
    state: DirectoryQueryState,
    overrides: Omit<DirectoryQueryOverrides, "page" | "limit"> = {},
    options: DirectoryQueryOptions = {},
): string {
    const params = new URLSearchParams();
    const q = overrides.q !== undefined ? overrides.q : state.search;
    if (q) params.set("q", q);

    if (options.serializeMembershipStatus) {
        const status =
            overrides.membershipStatus !== undefined
                ? overrides.membershipStatus
                : options.membershipStatus;
        const serialized = options.serializeMembershipStatus(status);
        if (serialized) params.set("mstat", serialized);
    }

    const sort = overrides.sort !== undefined ? overrides.sort : state.sort;
    const dir = overrides.dir !== undefined ? overrides.dir : state.dir;
    if (sort) {
        params.set("sort", sort);
        if (dir) params.set("dir", dir);
    }

    return params.toString();
}

export function createDirectoryRequestCoordinator() {
    let sequence = 0;
    let activeController: AbortController | null = null;

    return {
        start() {
            activeController?.abort();
            const controller = new AbortController();
            activeController = controller;
            return { controller, sequence: ++sequence };
        },
        isCurrent(requestSequence: number) {
            return requestSequence === sequence;
        },
        complete(requestSequence: number) {
            if (requestSequence === sequence) activeController = null;
        },
        teardown() {
            activeController?.abort();
            activeController = null;
            sequence += 1;
        },
        get sequence() {
            return sequence;
        },
    };
}

export function createSearchDebounce<T>(callback: (value: T) => void, delay = 500) {
    let timer: ReturnType<typeof setTimeout> | null = null;

    return {
        schedule(value: T) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                callback(value);
            }, delay);
        },
        cancel() {
            if (timer) clearTimeout(timer);
            timer = null;
        },
        get pending() {
            return timer !== null;
        },
    };
}
