export const CLIENT_DIRECTORY_PAGE_SIZES = [10, 20, 50, 100] as const;
export type ClientDirectoryPageSize = (typeof CLIENT_DIRECTORY_PAGE_SIZES)[number];
export type ClientDirectorySortDirection = "asc" | "desc";
export type ClientDirectorySortField =
    | "client_code"
    | "chinese_name"
    | "last_payment"
    | "membership_status";

export type ClientDirectorySort = {
    sort: ClientDirectorySortField | null;
    dir: ClientDirectorySortDirection;
};

const DEFAULT_PAGE_SIZE: ClientDirectoryPageSize = 20;
const CLIENT_DIRECTORY_SORT_FIELDS = new Set<string>([
    "client_code",
    "chinese_name",
    "last_payment",
    "membership_status",
]);

export function isClientDirectoryPageSize(value: number): value is ClientDirectoryPageSize {
    return (CLIENT_DIRECTORY_PAGE_SIZES as readonly number[]).includes(value);
}

export function resolveClientDirectoryPageSize(): ClientDirectoryPageSize {
    return DEFAULT_PAGE_SIZE;
}

export function resolveClientDirectorySort(input: {
    sort: string | null;
    dir: string | null;
}): ClientDirectorySort {
    const sort = CLIENT_DIRECTORY_SORT_FIELDS.has(input.sort ?? "")
        ? (input.sort as ClientDirectorySortField)
        : null;
    const dir = input.dir === "asc" ? "asc" : "desc";

    return { sort, dir };
}
