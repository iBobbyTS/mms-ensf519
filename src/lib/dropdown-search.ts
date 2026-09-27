import type {
    DropdownSearchItem as BaseDropdownSearchItem,
    DropdownSearchStatus,
} from "@ibobbyts/svelte-ui-utils/dropdown-search";

export {
    clampDropdownSearchLimit,
    normalizeDropdownSearchValue,
    resolveDropdownSearchStatus,
} from "@ibobbyts/svelte-ui-utils/dropdown-search/state";

export type { DropdownSearchStatus };

export type DropdownSearchItem = BaseDropdownSearchItem & {
    id: number;
    clientCode: string;
    title: string;
    chineseName: string;
    englishName: string | null;
    legalName?: string | null;
};

export function getDropdownSearchClientCode(
    item: BaseDropdownSearchItem | null,
): string | null {
    return typeof item?.clientCode === "string" ? item.clientCode : null;
}

export function getDropdownSearchLabel(item: BaseDropdownSearchItem): string {
    return item.label;
}

export function getDropdownSearchDisplayName(
    item: BaseDropdownSearchItem,
): string {
    const chineseName =
        typeof item.chineseName === "string" ? item.chineseName.trim() : "";
    if (chineseName) {
        return chineseName;
    }

    const englishName =
        typeof item.englishName === "string" ? item.englishName.trim() : "";
    if (englishName) {
        return englishName;
    }

    return getDropdownSearchClientCode(item) ?? item.label;
}

export function getDropdownSearchLegalName(
    item: BaseDropdownSearchItem,
): string | null {
    const legalName =
        typeof item.legalName === "string" ? item.legalName.trim() : "";
    return legalName || null;
}
