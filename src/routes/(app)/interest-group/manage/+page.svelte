<script lang="ts">
    import { FolderKanban, Pencil, Plus, Trash2 } from "lucide-svelte";
    import type {
        DropdownSearchChangeDetail,
        DropdownSearchItem,
        DropdownSearchLoadContext,
        DropdownSearchResult,
        DropdownSearchStatus,
    } from "@ibobbyts/svelte-ui-utils/dropdown-search";
    import {
        DataTable,
        FilterTable,
        filter,
        type FilterTableRow,
    } from "@ibobbyts/svelte-ui-utils/table";
    import * as m from "$lib/paraglide/messages";
    import { toSvelteUiLanguage } from "$lib/svelte-ui-language";
    import type { PageData } from "./$types";

    type InterestGroup = PageData["interestGroups"][number];

    let { data } : { data: PageData } = $props();
    const uiLanguage = $derived(toSvelteUiLanguage(data.locale));
    let createDialog = $state<HTMLDialogElement | null>(null);
    let editingId = $state<number | null>(null);
    let editingName = $state("");
    let interestGroupSearchValue = $state("");
    let selectedInterestGroupSearch = $state<DropdownSearchItem | null>(null);
    let interestGroupSearchStatus = $state<DropdownSearchStatus>("empty");
    const filteredInterestGroups = $derived(
        data.interestGroups.filter(matchesInterestGroupFilters),
    );
    const interestGroupFilterRows = $derived<FilterTableRow[]>([
        {
            key: "search",
            title: m.search(),
            filter: filter.dropdownSearch({
                value: interestGroupSearchValue,
                selectedItem: selectedInterestGroupSearch,
                status: interestGroupSearchStatus,
                placeholder: m.interestGroupName(),
                ariaLabel: m.search(),
                width: "18em",
                limit: 8,
                clearLabel: m.clear(),
                searchOnExternalValueChange: true,
                getItemLabel: (item) => item.label,
                loadOptions: loadInterestGroupSearchOptions,
                onChange: handleInterestGroupSearchChange,
            }),
        },
    ]);
    const interestGroupColumns = $derived([
        { key: "name", header: m.interestGroupName(), nowrap: false },
        {
            key: "actions",
            header: m.actions(),
            headerHorizontalAlign: "right" as const,
            cellHorizontalAlign: "right" as const,
        },
    ]);

    function startRename(interestGroupId: number, name: string) {
        editingId = interestGroupId;
        editingName = name;
    }

    function cancelRename() {
        editingId = null;
        editingName = "";
    }

    function normalizeInterestGroupSearch(value: string) {
        return value.trim().toLocaleLowerCase();
    }

    function interestGroupSearchItem(group: InterestGroup): DropdownSearchItem {
        return {
            id: group.id,
            value: String(group.id),
            label: group.name,
            title: group.name,
        };
    }

    function matchesInterestGroupFilters(group: InterestGroup) {
        const query = normalizeInterestGroupSearch(interestGroupSearchValue);
        if (!query) return true;
        return normalizeInterestGroupSearch(group.name).includes(query);
    }

    function loadInterestGroupSearchOptions(
        query: string,
        context: DropdownSearchLoadContext,
    ): DropdownSearchResult {
        const normalizedQuery = normalizeInterestGroupSearch(query);
        const matchingGroups = data.interestGroups.filter((group: InterestGroup) => {
            if (!normalizedQuery) return true;
            return normalizeInterestGroupSearch(group.name).includes(normalizedQuery);
        });
        const exactGroup = normalizedQuery
            ? data.interestGroups.find(
                    (group: InterestGroup) =>
                        normalizeInterestGroupSearch(group.name) === normalizedQuery,
                )
            : null;

        return {
            options: matchingGroups
                .slice(0, context.limit)
                .map(interestGroupSearchItem),
            exactMatch: exactGroup ? interestGroupSearchItem(exactGroup) : null,
        };
    }

    function handleInterestGroupSearchChange(detail: DropdownSearchChangeDetail) {
        interestGroupSearchValue = detail.value;
        selectedInterestGroupSearch = detail.selectedItem;
        interestGroupSearchStatus = detail.status;
    }
</script>

<div class="space-y-6">
    <div class="page-header">
        <div>
            <h1 class="page-title">
                <FolderKanban class="page-title-icon" />
                {m.groupManagementTitle()}
            </h1>
            <p class="page-description">{m.groupManagementDescription()}</p>
        </div>
        <button class="btn btn-primary" type="button" onclick={() => createDialog?.showModal()}>
            <Plus class="h-4 w-4" />
            {m.interestGroupCreateTitle()}
        </button>
    </div>

    {#if data.feedback}
        <div class="alert alert-success">
            <span>{data.feedback}</span>
        </div>
    {/if}
    {#if data.errorMessage}
        <div class="alert alert-error">
            <span>{data.errorMessage}</span>
        </div>
    {/if}

    <FilterTable rows={interestGroupFilterRows} language={uiLanguage} />

    <div class="ui-table-panel">
        <DataTable
            pagination={false}
            language={uiLanguage}
            rows={filteredInterestGroups}
            columns={interestGroupColumns}
            bordered={false}
            verticalSeparators={true}
            tableLayout="fixed"
            emptyText={m.noData()}
            rowKey="id"
            rowAttributes={(row) => ({ "data-interest-group-id": (row as InterestGroup).id })}
        >
            <svelte:fragment slot="cell" let:row let:column let:value>
                {@const interestGroup = row as InterestGroup}
                {#if column.key === "name"}
                    {#if editingId === interestGroup.id}
                        <form
                            method="POST"
                            action="/interest-group/manage/rename"
                            class="flex items-center gap-2"
                        >
                            <input
                                type="hidden"
                                name="interestGroupId"
                                value={interestGroup.id}
                            />
                            <input
                                class="input input-bordered input-sm w-full"
                                name="interestGroupName"
                                bind:value={editingName}
                            />
                            <button type="submit" class="btn btn-primary btn-sm">
                                {m.save()}
                            </button>
                            <button
                                type="button"
                                class="btn btn-ghost btn-sm"
                                onclick={cancelRename}
                            >
                                {m.returnBtn()}
                            </button>
                        </form>
                    {:else}
                        {interestGroup.name}
                    {/if}
                {:else if column.key === "actions"}
                    <div class="flex justify-end gap-2">
                        <button
                            type="button"
                            class="btn btn-xs btn-outline"
                            onclick={() =>
                                startRename(
                                    interestGroup.id,
                                    interestGroup.name,
                                )}
                        >
                            <Pencil class="h-3.5 w-3.5" />
                            {m.groupManagementRename()}
                        </button>
                        <form
                            method="POST"
                            action="/interest-group/manage/delete"
                            onsubmit={(event) => {
                                if (
                                    !confirm(
                                        m.groupManagementConfirmDelete({
                                            name: interestGroup.name,
                                        }),
                                    )
                                ) {
                                    event.preventDefault();
                                }
                            }}
                        >
                            <input
                                type="hidden"
                                name="interestGroupId"
                                value={interestGroup.id}
                            />
                            <button
                                type="submit"
                                class="btn btn-xs btn-outline btn-error"
                            >
                                <Trash2 class="h-3.5 w-3.5" />
                                {m.groupManagementDelete()}
                            </button>
                        </form>
                    </div>
                {:else}
                    {value}
                {/if}
            </svelte:fragment>
        </DataTable>
        <div
            class="flex justify-end border-t border-base-200 px-4 py-3 text-sm text-base-content/70"
        >
            {m.groupManagementTotal()}：{filteredInterestGroups.length}
        </div>
    </div>
</div>

<dialog class="modal" bind:this={createDialog}>
    <div class="ui-modal-box">
        <h2 class="text-xl font-bold">{m.interestGroupCreateTitle()}</h2>
        <form
            method="POST"
            action="/interest-group/manage/create"
            class="mt-5 grid gap-4"
        >
            <label class="form-control">
                <span class="label-text">{m.interestGroupName()}</span>
                <input
                    class="input input-bordered"
                    name="interestGroupName"
                    placeholder={m.interestGroupName()}
                    required
                />
            </label>
            <div class="modal-action">
                <button type="button" class="btn btn-ghost" onclick={() => createDialog?.close()}>
                    {m.returnBtn()}
                </button>
                <button type="submit" class="btn btn-primary">
                    {m.interestGroupCreateAction()}
                </button>
            </div>
        </form>
    </div>
    <form method="dialog" class="modal-backdrop">
        <button>{m.returnBtn()}</button>
    </form>
</dialog>
