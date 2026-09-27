<script lang="ts">
    import { goto } from "$app/navigation";
    import { CalendarClock, Users } from "lucide-svelte";
    import type { DropdownSearchChangeDetail } from "@ibobbyts/svelte-ui-utils/dropdown-search";
    import { clampDropdownSearchLimit } from "@ibobbyts/svelte-ui-utils/dropdown-search/state";
    import {
        FilterTable,
        filter,
        type FilterTableRow,
        type SortState,
    } from "@ibobbyts/svelte-ui-utils/table";

    import AttendanceScannerDialog from "$lib/components/AttendanceScannerDialog.svelte";
    import DirectoryPage from "$lib/components/DirectoryPage.svelte";
    import {
        getDropdownSearchClientCode,
        getDropdownSearchDisplayName,
        getDropdownSearchLegalName,
        type DropdownSearchItem,
        type DropdownSearchStatus,
    } from "$lib/dropdown-search";
    import {
        CLIENT_DIRECTORY_PAGE_SIZES,
        type ClientDirectorySort,
    } from "$lib/client-directory";
    import {
        buildDirectoryQuery,
        buildDirectoryQueryKey,
        committedDirectoryControls,
        createDirectoryRequestCoordinator,
        createSearchDebounce,
    } from "$lib/directory-page-state";
    import {
        DEFAULT_MEMBERSHIP_STATUS_FILTER,
        membershipStatusFilterValues,
        membershipStatusFromFilterValue,
        sameMembershipStatusFilter,
        serializeMstatParam,
        type MembershipStatusFilter,
    } from "$lib/membership-status-filter";
    import { getMembershipState as resolveMembershipState } from "$lib/membership-year-status";
    import { todayBusinessDate } from "$lib/local-date";
    import * as m from "$lib/paraglide/messages";
    import { toSvelteUiLanguage } from "$lib/svelte-ui-language";
    type ClientListItem = {
        id: number;
        clientCode: string;
        clientType: string;
        membershipType: string;
        displayName: string;
        chineseName: string;
        englishName: string | null;
        lastPayment: string | null;
        lastMembershipYear: number | null;
        status: string;
    };

    type DirectoryData = {
        members: ClientListItem[];
        total: number;
        page: number;
        limit: number;
        search: string;
        clientType: string;
        lockClientType?: boolean;
        membershipStatus?: MembershipStatusFilter;
        showMembershipStatusFilter?: boolean;
        locale?: string;
        sort: ClientDirectorySort;
    };

    let {
        data,
        title,
        description,
        addHref,
        addLabel,
        secondaryHref,
        secondaryLabel,
        clearHref,
    } : {
        data: DirectoryData;
        title: string;
        description: string;
        addHref: string;
        addLabel: string;
        secondaryHref?: string;
        secondaryLabel?: string;
        clearHref: string;
    } = $props();

    const initialDirectoryData = () => data;
    const initialShowMembershipStatusFilter = () => data.showMembershipStatusFilter;
    let directoryData = $state(initialDirectoryData());
    const requestCoordinator = createDirectoryRequestCoordinator();
    let requestLoading = $state(false);
    let requestError = $state<string | null>(null);

    let searchValue = $state("");
    let selectedSearch = $state<DropdownSearchItem | null>(null);
    let searchStatus = $state<DropdownSearchStatus>("empty");
    let membershipStatusFilter = $state(resolveMembershipStatus());
    let selectedDirectorySort = $state<ClientDirectorySort>(initialDirectoryData().sort);
    type DirectoryRefreshOverrides = {
        q?: string;
        page?: number;
        limit?: number;
        membershipStatus?: MembershipStatusFilter;
        sort?: ClientDirectorySort["sort"];
        dir?: ClientDirectorySort["dir"];
    };
    let retryOverrides = $state<DirectoryRefreshOverrides | null>(null);
    let retrySequence = $state(0);
    let directoryQueryKey = $state(
        buildDirectoryQueryKey(
            {
                search: initialDirectoryData().search,
                page: initialDirectoryData().page,
                limit: initialDirectoryData().limit,
                sort: initialDirectoryData().sort.sort,
                dir: initialDirectoryData().sort.dir,
            },
            {},
            initialShowMembershipStatusFilter()
                ? {
                      membershipStatus: initialDirectoryData().membershipStatus,
                      serializeMembershipStatus: (value) =>
                          serializeMstatParam(value as MembershipStatusFilter),
                  }
                : {},
        ),
    );
    const searchDebounce = createSearchDebounce((nextValue: string) => {
        const q = nextValue.trim();
        if (q !== directoryData.search) submitDirectoryQuery({ q });
    });
    const uiLanguage = $derived(toSvelteUiLanguage(data.locale));
    $effect(() => {
        searchValue = directoryData.search;
        selectedSearch = null;
    });
    $effect(() => {
        membershipStatusFilter = resolveMembershipStatus();
    });

    let scannerDialogOpen = $state(false);
    const directoryColumns = $derived([
        {
            key: "client_code",
            header: m.dashboardColumnCode(),
            sortable: true,
            class: "font-medium text-base-content/80 text-xs sm:text-sm",
        },
        {
            key: "chinese_name",
            header: m.dashboardColumnClient(),
            sortable: true,
            class: "font-bold",
            nowrap: false,
        },
        {
            key: "last_payment",
            header: m.dashboardColumnRecentPayment(),
            sortable: true,
            class: "hidden md:table-cell",
            headerClass: "hidden md:table-cell",
        },
        {
            key: "membership_status",
            header: m.dashboardColumnStatus(),
            sortable: true,
            class: "hidden md:table-cell",
            headerClass: "hidden md:table-cell",
            cellVerticalAlign: "middle" as const,
        },
        {
            key: "actions",
            header: m.dashboardColumnActions(),
            headerHorizontalAlign: "right" as const,
            cellHorizontalAlign: "right" as const,
        },
    ]);
    const directorySort = $derived<SortState | null>(
        selectedDirectorySort.sort
            ? {
                    key: selectedDirectorySort.sort,
                    direction: selectedDirectorySort.dir,
                }
            : null,
    );
    const directoryPagination = $derived({
        tableId: "client-directory",
        totalRows: directoryData.total,
        defaultPageSize: 20,
        pageSizeOptions: [...CLIENT_DIRECTORY_PAGE_SIZES],
        pageSizeLabel: m.dashboardPerPage(),
        queryKey: directoryQueryKey,
        onRequest: handleDirectoryPagination,
    });
    const directoryFilterRows = $derived<FilterTableRow[]>([
        ...(data.showMembershipStatusFilter
            ? [
                    {
                        key: "membershipStatus",
                        title: m.dashboardMembershipStatusFilter(),
                        filter: filter.checkbox({
                            value: membershipStatusFilterValues(effectiveMembershipStatus()),
                            options: [
                                { label: m.dashboardStatusActive(), value: "active" },
                                { label: m.dashboardStatusWarning(), value: "warning" },
                                { label: m.dashboardStatusExpired(), value: "expired" },
                                { label: m.dashboardLifetimeBadge(), value: "lifetime" },
                                { label: m.dashboardStatusDisabled(), value: "disabled" },
                            ],
                            onChange: handleMembershipStatusChange,
                        }),
                    },
                ]
            : []),
        {
            key: "search",
            title: m.dashboardSearchTitle(),
            filter: filter.container([
                filter.dropdownSearch({
                    value: searchValue,
                    selectedItem: selectedSearch,
                    status: searchStatus,
                    placeholder: m.dashboardSearchPlaceholder(),
                    ariaLabel: m.dashboardSearchPlaceholder(),
                    width: "16em",
                    limit: 8,
                    clearLabel: m.dashboardClear(),
                    searchOnExternalValueChange: true,
                    getItemLabel: (item) =>
                        getDropdownSearchClientCode(item) ?? item.label,
                    loadOptions: loadDirectorySearchOptions,
                    onChange: handleSearchChange,
                }),
                filter.button({
                    variant: "outline",
                    icon: "qr",
                    label: m.dashboardScan(),
                    onClick: openScannerDialog,
                }),
            ]),
        },
    ]);

    function getMembershipState(member: ClientListItem) {
        if (member.status === "disabled") return "disabled" as const;
        return resolveMembershipState({
            clientType: member.clientType,
            membershipType: member.membershipType,
            lastMembershipYear: member.lastMembershipYear,
            currentYear: Number(todayBusinessDate().slice(0, 4)),
        });
    }

    function openScannerDialog() {
        clearSearchDebounce();
        scannerDialogOpen = true;
    }

    function handleDirectoryScanDecoded(decodedText: string) {
        scannerDialogOpen = false;
        void goto(`/members/${decodedText}`);
    }

    $effect(() => {
        return () => {
            clearSearchDebounce();
            requestCoordinator.teardown();
        };
    });

    function resolveMembershipStatus(): MembershipStatusFilter {
        return data.membershipStatus ?? DEFAULT_MEMBERSHIP_STATUS_FILTER;
    }

    function effectiveMembershipStatus(): MembershipStatusFilter {
        return membershipStatusFilter;
    }

    function directoryQuery(overrides: {
        q?: string;
        page?: number;
        limit?: number;
        membershipStatus?: MembershipStatusFilter;
        sort?: ClientDirectorySort["sort"];
        dir?: ClientDirectorySort["dir"];
    } = {}): string {
        return buildDirectoryQuery(
            {
                search: searchValue.trim(),
                page: directoryData.page,
                limit: directoryData.limit,
                sort: selectedDirectorySort.sort,
                dir: selectedDirectorySort.dir,
            },
            overrides,
            data.showMembershipStatusFilter
                ? {
                      membershipStatus: effectiveMembershipStatus(),
                      serializeMembershipStatus: (value) =>
                          serializeMstatParam(value as MembershipStatusFilter),
                  }
                : {},
        );
    }

    function directoryUrl(overrides: {
        q?: string;
        page?: number;
        limit?: number;
        membershipStatus?: MembershipStatusFilter;
        sort?: ClientDirectorySort["sort"];
        dir?: ClientDirectorySort["dir"];
    } = {}): string {
        return `/api/members/directory?${directoryQuery(overrides)}`;
    }

    function handleSearchChange(detail: DropdownSearchChangeDetail) {
        const valueChanged = detail.value !== searchValue;
        searchValue = detail.value;
        selectedSearch = detail.selectedItem as DropdownSearchItem | null;
        searchStatus = detail.status as DropdownSearchStatus;
        if (valueChanged) {
            scheduleSearchNavigation(detail.value);
        }
    }

    function scheduleSearchNavigation(nextValue: string) {
        searchDebounce.schedule(nextValue);
    }

    function clearSearchDebounce() {
        searchDebounce.cancel();
    }

    function currentDirectoryQueryKey(overrides: DirectoryRefreshOverrides = {}) {
        return buildDirectoryQueryKey(
            {
                search: searchValue.trim(),
                page: directoryData.page,
                limit: directoryData.limit,
                sort: selectedDirectorySort.sort,
                dir: selectedDirectorySort.dir,
            },
            overrides,
            data.showMembershipStatusFilter
                ? {
                      membershipStatus: effectiveMembershipStatus(),
                      serializeMembershipStatus: (value) =>
                          serializeMstatParam(value as MembershipStatusFilter),
                  }
                : {},
        );
    }

    function submitDirectoryQuery(overrides: DirectoryRefreshOverrides = {}) {
        if (overrides.q !== undefined) searchValue = overrides.q;
        if (overrides.membershipStatus !== undefined) {
            membershipStatusFilter = overrides.membershipStatus;
        }
        if (overrides.sort !== undefined || overrides.dir !== undefined) {
            selectedDirectorySort = {
                sort: (overrides.sort ?? selectedDirectorySort.sort) as ClientDirectorySort["sort"],
                dir: overrides.dir ?? selectedDirectorySort.dir,
            };
        }
        directoryQueryKey = currentDirectoryQueryKey(overrides);
    }

    async function refreshDirectory(overrides: DirectoryRefreshOverrides = {}) {
        const { controller, sequence } = requestCoordinator.start();
        const requestOverrides: DirectoryRefreshOverrides = {
            q: overrides.q ?? searchValue.trim(),
            page: overrides.page ?? directoryData.page,
            limit: overrides.limit ?? directoryData.limit,
            membershipStatus: data.showMembershipStatusFilter
                ? (overrides.membershipStatus ?? effectiveMembershipStatus())
                : undefined,
            sort:
                overrides.sort !== undefined
                    ? overrides.sort
                    : selectedDirectorySort.sort,
            dir: overrides.dir ?? selectedDirectorySort.dir,
        };
        retryOverrides = requestOverrides;
        requestLoading = true;
        requestError = null;
        try {
            const response = await fetch(directoryUrl(requestOverrides), { signal: controller.signal });
            if (!response.ok) throw new Error(`Directory request failed (${response.status})`);
            const result = (await response.json()) as { data: DirectoryData };
            if (!requestCoordinator.isCurrent(sequence)) return;
            directoryData = result.data;
            retryOverrides = null;
            membershipStatusFilter = result.data.membershipStatus ?? DEFAULT_MEMBERSHIP_STATUS_FILTER;
            selectedDirectorySort = result.data.sort;
            searchValue = result.data.search;
            selectedSearch = null;
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            if (requestCoordinator.isCurrent(sequence)) {
                requestError = m.networkRequestFailed();
                const controls = committedDirectoryControls(directoryData);
                searchValue = controls.search;
                selectedSearch = null;
                membershipStatusFilter =
                    (controls.membershipStatus as MembershipStatusFilter | undefined) ??
                    DEFAULT_MEMBERSHIP_STATUS_FILTER;
                selectedDirectorySort = directoryData.sort;
                throw error;
            }
        } finally {
            if (requestCoordinator.isCurrent(sequence)) {
                requestLoading = false;
                requestCoordinator.complete(sequence);
            }
        }
    }

    function retryDirectory() {
        if (!retryOverrides) return;
        const overrides = retryOverrides;
        searchValue = overrides.q ?? directoryData.search;
        if (overrides.membershipStatus !== undefined) {
            membershipStatusFilter = overrides.membershipStatus;
        }
        if (overrides.sort !== undefined || overrides.dir !== undefined) {
            selectedDirectorySort = {
                sort:
                    overrides.sort !== undefined
                        ? overrides.sort
                        : selectedDirectorySort.sort,
                dir: overrides.dir ?? selectedDirectorySort.dir,
            };
        }
        directoryQueryKey = `${currentDirectoryQueryKey(overrides)}|retry:${++retrySequence}`;
    }

    function handleMembershipStatusChange(value: Array<string | number>) {
        clearSearchDebounce();
        const next = membershipStatusFromFilterValue(value);
        if (!sameMembershipStatusFilter(next, effectiveMembershipStatus())) {
            membershipStatusFilter = next;
            submitDirectoryQuery({ membershipStatus: next });
        }
    }

    async function loadDirectorySearchOptions(
        query: string,
        context: { limit: number },
    ) {
        const params = new URLSearchParams();
        params.set("q", query);
        params.set("limit", String(clampDropdownSearchLimit(context.limit)));
        params.set("clientType", "Member");
        params.set("fields", "legalName");
        const response = await fetch(`/api/members/search?${params.toString()}`);
        const result = (await response.json()) as {
            options: DropdownSearchItem[];
            exactMatch: DropdownSearchItem | null;
        };

        return {
            options: result.options.map(formatDirectorySearchItem),
            exactMatch: result.exactMatch
                ? formatDirectorySearchItem(result.exactMatch)
                : null,
        };
    }

    function formatDirectorySearchItem(item: DropdownSearchItem): DropdownSearchItem {
        const clientCode = getDropdownSearchClientCode(item) ?? String(item.id);
        const title = `${getDropdownSearchDisplayName(item)} (${clientCode})`;

        return {
            ...item,
            title,
            label: title,
            param_dict: {
                [m.legalName()]: getDropdownSearchLegalName(item) ?? m.notAvailable(),
            },
        };
    }

    function handleDirectorySort(nextSort: SortState) {
        clearSearchDebounce();
        submitDirectoryQuery({
            sort: nextSort.key as ClientDirectorySort["sort"],
            dir: nextSort.direction,
        });
    }

    function handleDirectoryPagination(next: { page: number; pageSize: number }) {
        clearSearchDebounce();
        return refreshDirectory({ page: next.page, limit: next.pageSize });
    }
</script>

<DirectoryPage
    {title}
    {description}
    {addHref}
    {addLabel}
    {secondaryHref}
    {secondaryLabel}
    rows={directoryData.members}
    columns={directoryColumns}
    loading={requestLoading}
    locale={directoryData.locale}
    sort={directorySort}
    onSortChange={handleDirectorySort}
    pagination={directoryPagination}
>
    {#snippet titleIcon()}
        <Users class="page-title-icon" />
    {/snippet}

    {#snippet filters()}
        <FilterTable rows={directoryFilterRows} language={uiLanguage} />
        {#if requestError}
            <div class="flex items-center gap-2 text-error text-sm">
                <p>{requestError}</p>
                <button type="button" class="btn btn-ghost btn-xs" onclick={retryDirectory}>{m.directoryRetry()}</button>
            </div>
        {/if}
    {/snippet}

    {#snippet cell(row, column, value)}
        {@const member = row as ClientListItem}
        {@const col = column as { key: string }}
        {@const membershipState = getMembershipState(member)}
        {#if col.key === "client_code"}
            {member.clientCode}
        {:else if col.key === "chinese_name"}
            {member.displayName}
            {#if member.chineseName && member.englishName}
                <div class="text-xs font-normal text-base-content/60">{member.englishName}</div>
            {/if}
        {:else if col.key === "last_payment"}
            {#if member.lastPayment}
                <span class="flex items-center gap-1 text-sm text-base-content/70">
                    <CalendarClock class="w-3 h-3" />
                    {member.lastPayment}
                </span>
            {:else}
                <span class="text-base-content/40 text-xs">-</span>
            {/if}
        {:else if col.key === "membership_status"}
            {#if membershipState === "disabled"}
                <div class="badge badge-neutral">{m.dashboardStatusDisabled()}</div>
            {:else if membershipState === "valid"}
                <div class="badge badge-success">
                    {member.membershipType === "Lifetime"
                        ? m.dashboardLifetimeBadge()
                        : m.dashboardStatusActive()}
                </div>
            {:else if membershipState === "grace"}
                <div class="badge badge-warning">{m.dashboardStatusWarning()}</div>
            {:else}
                <div class="badge badge-error">{m.dashboardStatusExpired()}</div>
            {/if}
        {:else if col.key === "actions"}
            <div class="flex justify-end gap-2">
                <a
                    href={`/members/${member.clientCode}`}
                    class="btn btn-sm btn-outline"
                    data-sveltekit-reload
                >
                    {m.dashboardView()}
                </a>
            </div>
        {:else}
            {value}
        {/if}
    {/snippet}
</DirectoryPage>

<div class="contents">
    <AttendanceScannerDialog
        open={scannerDialogOpen}
        readerId="client-directory-reader"
        title={m.dashboardScanTitle()}
        cameraFailedMessage={m.dashboardScannerStartFailed()}
        onDecoded={handleDirectoryScanDecoded}
        onOpenChange={(open) => {
            scannerDialogOpen = open;
        }}
    />
</div>
