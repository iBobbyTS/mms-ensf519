<script lang="ts">
    import { Download, UserPlus } from "lucide-svelte";
    import type { Snippet } from "svelte";
    import {
        DataTable,
        type DataTableColumn,
        type DataTableServerPagination,
        type SortState,
    } from "@ibobbyts/svelte-ui-utils/table";

    import * as m from "$lib/paraglide/messages";
    import { toSvelteUiLanguage } from "$lib/svelte-ui-language";

    let {
        title,
        description,
        addHref,
        addLabel,
        secondaryHref,
        secondaryLabel,
        rows,
        columns,
        locale,
        pagination,
        emptyText = m.dashboardNoRecords(),
        rowKey = "id",
        sort = null,
        titleIcon,
        filters,
        loading = false,
        cell,
        onSortChange,
    } : {
        title: string;
        description?: string;
        addHref: string;
        addLabel: string;
        secondaryHref?: string;
        secondaryLabel?: string;
        rows: unknown[];
        columns: DataTableColumn[];
        locale?: string;
        pagination: false | DataTableServerPagination;
        emptyText?: string;
        rowKey?: string;
        sort?: SortState | null;
        titleIcon?: Snippet;
        filters?: Snippet;
        loading?: boolean;
        cell?: Snippet<[unknown, unknown, unknown]>;
        onSortChange?: (nextSort: SortState) => void | Promise<void>;
    } = $props();

    const uiLanguage = $derived(toSvelteUiLanguage(locale));
</script>

<div class="space-y-6">
    {#if loading}
        <div class="pointer-events-none fixed inset-x-0 top-[calc(var(--app-navbar-height)+0.75rem)] z-[60] flex justify-center px-4">
            <div
                class="pointer-events-auto flex items-center gap-2 rounded-full border border-primary/20 bg-base-100 px-4 py-2 text-sm text-base-content shadow-lg"
                role="status"
                aria-live="polite"
                aria-busy="true"
            >
                <span class="loading loading-spinner loading-sm text-primary" aria-hidden="true"></span>
                <span>{m.directoryLoading()}</span>
            </div>
        </div>
    {/if}
    <div class="page-header">
        <div>
            <h1 class="page-title">
                {#if titleIcon}
                    {@render titleIcon()}
                {/if}
                {title}
            </h1>
            {#if description}
                <p class="page-description">{description}</p>
            {/if}
        </div>
        <div class="flex flex-wrap gap-3">
            {#if secondaryHref && secondaryLabel}
                <a href={secondaryHref} class="btn btn-outline min-w-[120px]"><Download class="h-5 w-5" /> {secondaryLabel}</a>
            {/if}
            <a href={addHref} class="btn btn-primary min-w-[120px]">
                <UserPlus class="h-5 w-5" /> {addLabel}
            </a>
        </div>
    </div>

    {#if filters}
        {@render filters()}
    {/if}

    <div class="ui-table-panel">
        <DataTable
            language={uiLanguage}
            {rows}
            {columns}
            bordered={false}
            verticalSeparators={true}
            tableLayout="fixed"
            {emptyText}
            {rowKey}
            {sort}
            {pagination}
            onSortChange={onSortChange}
        >
            <svelte:fragment slot="cell" let:row let:column let:value>
                {#if cell}
                    {@render cell(row, column, value)}
                {:else}
                    {value}
                {/if}
            </svelte:fragment>
        </DataTable>
    </div>
</div>
