<script lang="ts">
    import { untrack } from "svelte";
    import { Dropdown, type DropdownOption, type DropdownValue } from "@ibobbyts/svelte-ui-utils/dropdown";
    import { CalendarDays } from "lucide-svelte";

    import { scheduleAttendanceFocusRestore } from "$lib/attendance-focus";
    import MemberAttendancePanel from "$lib/components/MemberAttendancePanel.svelte";
    import * as m from "$lib/paraglide/messages";
    import type { PageData } from "./$types";

    let { data } : { data: PageData } = $props();
    let interestGroupId = $state(untrack(() => data.interestGroupId));
    let records = $state(untrack(() => data.records));
    let counters = $state(untrack(() => data.counters));
    let refreshController: AbortController | null = null;

    const attendanceInputId = "interest-group-attendance-member-search";
    const interestGroupSelectId = "interest-group-attendance-group-select";
    let interestGroupDropdownElement = $state<HTMLDivElement>();
    const interestGroupOptions = $derived<DropdownOption[]>(
        data.interestGroups.map((interestGroup: PageData["interestGroups"][number]) => ({
            label: interestGroup.name,
            value: String(interestGroup.id),
        })),
    );
    const selectedInterestGroupName = $derived(
        data.interestGroups.find((interestGroup: PageData["interestGroups"][number]) => interestGroup.id === interestGroupId)
            ?.name ?? "",
    );

    async function updateFilters(nextInterestGroupId: number) {
        refreshController?.abort();
        const controller = new AbortController();
        refreshController = controller;
        const response = await fetch(`/interest-group/attendance/data?interest_group_id=${nextInterestGroupId}`, { signal: controller.signal });
        if (!response.ok || controller.signal.aborted) return;
        const snapshot = await response.json() as { records: PageData["records"]; counters: PageData["counters"] };
        if (refreshController !== controller) return;
        interestGroupId = nextInterestGroupId;
        records = snapshot.records;
        counters = snapshot.counters;
    }

    function handleInterestGroupChange(value: DropdownValue) {
        const nextInterestGroupId = Number(value);
        if (Number.isInteger(nextInterestGroupId) && nextInterestGroupId > 0) {
            scheduleAttendanceFocusRestore();
            void updateFilters(nextInterestGroupId);
        }
    }

    function handleInterestGroupDropdownPointerDown(event: PointerEvent) {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }

        if (!interestGroupDropdownElement?.contains(target)) {
            return;
        }

        if (target.closest(".suu-dropdown__option")) {
            scheduleAttendanceFocusRestore();
        }
    }

    $effect(() => () => refreshController?.abort());

    $effect(() => {
        document.addEventListener("pointerdown", handleInterestGroupDropdownPointerDown, true);

        return () => {
            document.removeEventListener("pointerdown", handleInterestGroupDropdownPointerDown, true);
        };
    });
</script>

<div class="space-y-6">
    <div>
        <div>
            <h1 class="page-title">
                <CalendarDays class="page-title-icon" />
                {m.interestGroupCheckInTitle()}
                {#if selectedInterestGroupName}
                    <span class="selected-interest-group-title">（{selectedInterestGroupName}）</span>
                {/if}
            </h1>
        </div>
    </div>

    <MemberAttendancePanel
        targetId={interestGroupId}
        targetIdKey="interest_group_id"
        checkEndpoint="/interest-group/attendance/register"
        undoEndpoint="/interest-group/attendance/unregister"
        records={records}
        counters={{ ...counters }}
        counterDefinitions={[
            { key: "todayTotal", label: m.attendanceToday(), tone: "primary" },
            { key: "monthTotal", label: m.attendanceMonth(), tone: "secondary" },
        ]}
        requiredMessage={m.interestGroupAttendanceRequired()}
        inputId={attendanceInputId}
        scanReaderId="interest-group-attendance-reader"
        tableTitle={m.attendanceTableSectionTitle()}
        noRecordsMessage={m.attendanceNoRecords()}
        memberSearchClientType="participant"
        showFsiiSurveyCompletedColumn={true}
        undoPlacement="row"
    >
        {#snippet actionsHeader()}
            <div
                bind:this={interestGroupDropdownElement}
                class="interest-group-attendance-dropdown"
            >
                <Dropdown
                    id={interestGroupSelectId}
                    value={String(interestGroupId ?? "")}
                    options={interestGroupOptions}
                    ariaLabel={m.interestGroup()}
                    fitViewport={true}
                    fitContent={true}
                    onChange={handleInterestGroupChange}
                />
            </div>
        {/snippet}
    </MemberAttendancePanel>
</div>

<style>
    .selected-interest-group-title {
        color: #1e3a8a;
    }

    :global([data-theme="dark"]) .selected-interest-group-title {
        color: #facc15;
    }

    :global(.interest-group-attendance-dropdown .suu-dropdown__panel) {
        font-size: 1rem;
    }
</style>
