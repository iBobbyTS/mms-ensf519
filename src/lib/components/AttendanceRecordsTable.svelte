<script lang="ts">
    import type { UiLanguage } from "@ibobbyts/svelte-ui-utils";
    import { DataTable } from "@ibobbyts/svelte-ui-utils/table";
    import { Undo2 } from "lucide-svelte";

    import type { AttendanceRecord } from "$lib/attendance-panel";
    import * as m from "$lib/paraglide/messages";

    let {
        language,
        records,
        tableTitle,
        noRecordsMessage,
        showWalkInBadge = false,
        walkInBadgeLabel = "",
        showRegisteredAtColumn = false,
        showCheckedOutAtColumn = false,
        showLatestFsiiSurveyDateColumn = false,
        showFsiiSurveyCompletedColumn = false,
        showUndoColumn = false,
        undoDisabled = false,
        canUndoRecord,
        onUndoRecord,
    } : {
        language: UiLanguage;
        records: AttendanceRecord[];
        tableTitle: string;
        noRecordsMessage: string;
        showWalkInBadge?: boolean;
        walkInBadgeLabel?: string;
        showRegisteredAtColumn?: boolean;
        showCheckedOutAtColumn?: boolean;
        showLatestFsiiSurveyDateColumn?: boolean;
        showFsiiSurveyCompletedColumn?: boolean;
        showUndoColumn?: boolean;
        undoDisabled?: boolean;
        canUndoRecord?: (record: AttendanceRecord) => boolean;
        onUndoRecord?: (record: AttendanceRecord) => void;
    } = $props();

    const attendanceColumns = $derived([
        {
            key: "clientCode",
            header: m.attendanceColumnMemberCode(),
            class: "font-medium",
        },
        { key: "name", header: m.attendanceColumnName(), nowrap: false },
        ...(showRegisteredAtColumn
            ? [{ key: "registeredAt", header: m.attendanceColumnRegisteredAt() }]
            : []),
        { key: "attendedAt", header: m.attendanceColumnTime() },
        ...(showCheckedOutAtColumn
            ? [{ key: "checkedOutAt", header: m.attendanceColumnCheckOutTime() }]
            : []),
        ...(showLatestFsiiSurveyDateColumn
            ? [{ key: "latestFsiiSurveyDate", header: m.attendanceColumnLatestFsiiSurveyDate() }]
            : []),
        ...(showFsiiSurveyCompletedColumn
            ? [{ key: "fsiiSurveyCompletedThisYear", header: m.attendanceColumnFsiiSurveyCompleted() }]
            : []),
        ...(showUndoColumn ? [{ key: "undo", header: "", class: "w-0 text-right" }] : []),
    ]);
</script>

<div class="card ui-table-panel">
    <div class="border-b border-base-200 px-4 py-3 text-center text-lg font-semibold text-base-content">
        {tableTitle}
    </div>
    <div class="card-body p-0">
        <DataTable
            pagination={false}
            {language}
            rows={records}
            columns={attendanceColumns}
            bordered={false}
            emptyText={noRecordsMessage}
            rowKey={(row) => (row as AttendanceRecord).id}
        >
            <svelte:fragment slot="cell" let:row let:column let:value>
                {@const record = row as AttendanceRecord}
                {#if column.key === "name"}
                    {record.chineseName}
                    {#if showWalkInBadge && !record.wasRegisteredWhenAttended}
                        <div class="badge badge-warning badge-sm mt-1">
                            {walkInBadgeLabel}
                        </div>
                    {/if}
                {:else if column.key === "registeredAt"}
                    {record.registeredAt ?? ""}
                {:else if column.key === "checkedOutAt"}
                    {record.checkedOutAt ?? ""}
                {:else if column.key === "latestFsiiSurveyDate"}
                    {record.latestFsiiSurveyDate || "--"}
                {:else if column.key === "fsiiSurveyCompletedThisYear"}
                    {#if record.fsiiSurveyCompletedThisYear}✅{/if}
                {:else if column.key === "undo"}
                    {#if canUndoRecord?.(record)}
                        <button
                            type="button"
                            class="btn btn-outline btn-warning btn-sm whitespace-nowrap"
                            disabled={undoDisabled}
                            aria-label={m.attendanceUndo()}
                            title={m.attendanceUndo()}
                            onclick={() => onUndoRecord?.(record)}
                        >
                            <Undo2 class="h-4 w-4" />
                            {m.attendanceUndo()}
                        </button>
                    {/if}
                {:else}
                    {value}
                {/if}
            </svelte:fragment>
        </DataTable>
    </div>
</div>
