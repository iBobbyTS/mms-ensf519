<script lang="ts">
    import { page } from "$app/state";
    import { Undo2 } from "lucide-svelte";
    import { onMount, tick, type Snippet } from "svelte";
    import {
        DropdownSearch,
        type DropdownSearchEnterDetail,
        type DropdownSearchItem as BaseDropdownSearchItem,
    } from "@ibobbyts/svelte-ui-utils/dropdown-search";
    import { toast } from "@ibobbyts/svelte-ui-utils/toast";

    import { ATTENDANCE_FOCUS_RESTORE_EVENT } from "$lib/attendance-focus";
    import { loadAttendanceMemberOptions } from "$lib/attendance-member-search";
    import type {
        AttendanceConfirmation,
        AttendanceCounterDefinition,
        AttendanceFeedback,
        AttendanceRecord,
        AttendanceReminder,
    } from "$lib/attendance-panel";
    import AttendanceCounters from "$lib/components/AttendanceCounters.svelte";
    import AttendanceDialogs from "$lib/components/AttendanceDialogs.svelte";
    import AttendanceRecordsTable from "$lib/components/AttendanceRecordsTable.svelte";
    import AttendanceScanner from "$lib/components/AttendanceScanner.svelte";
    import type {
        DropdownSearchItem,
        DropdownSearchStatus,
    } from "$lib/dropdown-search";
    import {
        getAttendanceUndoRemainingMs,
        resolveAttendanceSubmissionOutcome,
        resolveContinuousScanResult,
        shouldFailSubmittedAttendanceLookup,
        shouldAutoRegisterScannedMember,
        type AttendanceSubmissionResultPayload,
    } from "$lib/member-attendance";
    import * as m from "$lib/paraglide/messages";
    import { toSvelteUiLanguage } from "$lib/svelte-ui-language";

    type SubmitAttendanceOptions = {
        member?: DropdownSearchItem;
        record?: AttendanceRecord;
        forceRegisterAgain?: boolean;
    };

    type AttendanceUndoPlacement = "input" | "row" | "none";
    type SubmittedAttendanceLookup = {
        token: number;
        value: string;
    };

    const ATTENDANCE_SUBMITTED_LOOKUP_TIMEOUT_MS = 10_000;

    let {
        targetId,
        targetIdKey,
        checkEndpoint,
        undoEndpoint,
        checkoutEndpoint,
        records: initialRecords,
        counters: initialCounters,
        counterDefinitions,
        requiredMessage,
        inputId,
        scanReaderId,
        tableTitle,
        noRecordsMessage,
        scannerPlacement = "button",
        showWalkInBadge = false,
        walkInBadgeLabel = "",
        showCheckedOutAtColumn = false,
        showLatestFsiiSurveyDateColumn = false,
        showFsiiSurveyCompletedColumn = false,
        memberSearchClientType = "participant",
        additionalMemberSearchEndpoint,
        undoPlacement = "input",
        actionsHeader,
    } : {
        targetId: number | null;
        targetIdKey?: string;
        checkEndpoint: string;
        undoEndpoint: string;
        checkoutEndpoint?: string;
        records: AttendanceRecord[];
        counters: Record<string, number>;
        counterDefinitions: AttendanceCounterDefinition[];
        requiredMessage: string;
        inputId: string;
        scanReaderId: string;
        tableTitle: string;
        noRecordsMessage: string;
        scannerPlacement?: "button" | "inline";
        showWalkInBadge?: boolean;
        walkInBadgeLabel?: string;
        showCheckedOutAtColumn?: boolean;
        showLatestFsiiSurveyDateColumn?: boolean;
        showFsiiSurveyCompletedColumn?: boolean;
        memberSearchClientType?: "participant" | "Member";
        additionalMemberSearchEndpoint?: string;
        undoPlacement?: AttendanceUndoPlacement;
        actionsHeader?: Snippet;
    } = $props();

    let memberSearchValue = $state("");
    let selectedMember = $state<DropdownSearchItem | null>(null);
    let memberSearchStatus = $state<DropdownSearchStatus>("empty");
    let feedback = $state<AttendanceFeedback | null>(null);
    let records = $state<AttendanceRecord[]>([]);
    let counters = $state<Record<string, number>>({});
    let isSubmitting = $state(false);
    let showSubmittingOverlay = $state(false);
    let isScanning = $state(false);
    let scannerInlineOpen = $state(false);
    let shouldAutoRegisterAfterScan = $state(false);
    let submittedAttendanceLookup = $state<SubmittedAttendanceLookup | null>(null);
    let lastAcceptedScanText = $state("");
    let lastAcceptedScanAtMs = $state<number | null>(null);
    let attendanceConfirmation = $state<AttendanceConfirmation | null>(null);
    let attendanceReminder = $state<AttendanceReminder | null>(null);
    let attendanceInputResetVersion = $state(0);
    let submittedAttendanceLookupToken = 0;
    let scanButtonId = $derived(`${inputId}-scan-button`);
    let cameraModeCheckboxId = $derived(`${inputId}-camera-mode`);
    let submittingOverlayTimer: ReturnType<typeof setTimeout> | null = null;
    let submittedAttendanceLookupTimer: ReturnType<typeof setTimeout> | null = null;
    let attendanceConfirmationTimer: ReturnType<typeof setTimeout> | null = null;
    let attendanceConfirmationCountdownTimer: ReturnType<typeof setInterval> | null = null;
    let attendanceReminderTimer: ReturnType<typeof setTimeout> | null = null;
    let undoVisibilityTimer: ReturnType<typeof setInterval> | null = null;
    let undoVisibilityTick = $state(0);
    const uiLanguage = $derived(toSvelteUiLanguage(page.data.locale as string | undefined));
    const hasAttendanceTarget = $derived(targetIdKey ? Boolean(targetId) : true);
    const hasAttendanceDialog = $derived(Boolean(attendanceConfirmation) || Boolean(attendanceReminder));
    const attendanceInputLocked = $derived(
        isSubmitting || hasAttendanceDialog || Boolean(submittedAttendanceLookup),
    );
    const showAttendanceProcessingOverlay = $derived(
        showSubmittingOverlay || isSubmitting || Boolean(submittedAttendanceLookup),
    );
    const showInputUndoButton = $derived(undoPlacement === "input");
    const showRowUndoColumn = $derived(undoPlacement === "row");

    async function focusAttendanceInput(options: { forceFocusEvent?: boolean } = {}) {
        await tick();
        const input = document.getElementById(inputId);
        if (input instanceof HTMLInputElement) {
            if (options.forceFocusEvent && document.activeElement === input) {
                input.dispatchEvent(new FocusEvent("focus"));
                return;
            }

            input.focus();
        }
    }

    function blurAttendanceInput() {
        const input = document.getElementById(inputId);
        if (input instanceof HTMLInputElement) {
            input.blur();
        }
    }

    function shouldRestoreFocusFromBlankPointer(target: EventTarget | null) {
        if (!(target instanceof Element)) {
            return false;
        }

        if (!target.closest("main")) {
            return false;
        }

        return !target.closest(
            [
                "a",
                "button",
                "input",
                "label",
                "select",
                "textarea",
                "[contenteditable='true']",
                "[role='button']",
                "[role='option']",
                ".suu-dropdown",
                ".suu-dropdown-search",
                ".suu-dropdown-search__menu",
                ".suu-dialog",
                ".suu-dialog-backdrop",
            ].join(","),
        );
    }

    function scheduleAttendanceInputFocus(delayMs = 250) {
        setTimeout(() => {
            void focusAttendanceInput({ forceFocusEvent: true });
        }, delayMs);
    }

    onMount(() => {
        const handleAttendanceFocusRestore = () => {
            if (!hasAttendanceTarget) {
                return;
            }

            scheduleAttendanceInputFocus();
        };

        const handleDocumentPointerDown = (event: PointerEvent) => {
            if (!hasAttendanceTarget || !shouldRestoreFocusFromBlankPointer(event.target)) {
                return;
            }

            scheduleAttendanceInputFocus();
        };

        window.addEventListener(ATTENDANCE_FOCUS_RESTORE_EVENT, handleAttendanceFocusRestore);
        document.addEventListener("pointerdown", handleDocumentPointerDown, true);
        if (undoPlacement === "row") {
            undoVisibilityTimer = setInterval(() => {
                undoVisibilityTick = Date.now();
            }, 1000);
        }

        return () => {
            window.removeEventListener(
                ATTENDANCE_FOCUS_RESTORE_EVENT,
                handleAttendanceFocusRestore,
            );
            document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
            clearSubmittingOverlayTimer();
            clearSubmittedAttendanceLookupTimer();
            clearAttendanceConfirmationTimers();
            clearAttendanceReminderTimer();
            clearUndoVisibilityTimer();
        };
    });

    function clearUndoVisibilityTimer() {
        if (!undoVisibilityTimer) {
            return;
        }

        clearInterval(undoVisibilityTimer);
        undoVisibilityTimer = null;
    }

    function clearSubmittingOverlayTimer() {
        if (!submittingOverlayTimer) {
            return;
        }

        clearTimeout(submittingOverlayTimer);
        submittingOverlayTimer = null;
    }

    function startSubmittingOverlayTimer() {
        clearSubmittingOverlayTimer();
        showSubmittingOverlay = false;
        submittingOverlayTimer = setTimeout(() => {
            showSubmittingOverlay = true;
            submittingOverlayTimer = null;
        }, 500);
    }

    function stopSubmittingOverlay() {
        clearSubmittingOverlayTimer();
        showSubmittingOverlay = false;
    }

    function clearSubmittedAttendanceLookupTimer() {
        if (!submittedAttendanceLookupTimer) {
            return;
        }

        clearTimeout(submittedAttendanceLookupTimer);
        submittedAttendanceLookupTimer = null;
    }

    function resetMemberSelection(options: { forceComponentReset?: boolean } = {}) {
        selectedMember = null;
        memberSearchValue = "";
        memberSearchStatus = "empty";
        shouldAutoRegisterAfterScan = false;
        if (options.forceComponentReset) {
            attendanceInputResetVersion += 1;
        }
    }

    async function finishAttendanceInputCycle(options: {
        feedback?: AttendanceFeedback;
        focus?: boolean;
    } = {}) {
        clearSubmittedAttendanceLookupTimer();
        submittedAttendanceLookup = null;
        stopSubmittingOverlay();
        resetMemberSelection({ forceComponentReset: true });
        if (options.feedback) {
            feedback = options.feedback;
        }
        if (options.focus ?? true) {
            await focusAttendanceInput();
        }
    }

    function startSubmittedAttendanceLookup(value: string) {
        clearSubmittedAttendanceLookupTimer();
        submittedAttendanceLookupToken += 1;
        const token = submittedAttendanceLookupToken;
        submittedAttendanceLookup = { token, value };
        shouldAutoRegisterAfterScan = true;
        showSubmittingOverlay = true;
        blurAttendanceInput();
        submittedAttendanceLookupTimer = setTimeout(() => {
            if (submittedAttendanceLookup?.token !== token) {
                return;
            }

            void finishAttendanceInputCycle({
                feedback: {
                    tone: "error",
                    message: m.attendanceLookupTimeout({ seconds: 10 }),
                },
            });
        }, ATTENDANCE_SUBMITTED_LOOKUP_TIMEOUT_MS);
    }

    function clearAttendanceConfirmationTimers() {
        if (attendanceConfirmationTimer) {
            clearTimeout(attendanceConfirmationTimer);
            attendanceConfirmationTimer = null;
        }

        if (attendanceConfirmationCountdownTimer) {
            clearInterval(attendanceConfirmationCountdownTimer);
            attendanceConfirmationCountdownTimer = null;
        }
    }

    function clearAttendanceReminderTimer() {
        if (!attendanceReminderTimer) {
            return;
        }

        clearTimeout(attendanceReminderTimer);
        attendanceReminderTimer = null;
    }

    function startAttendanceConfirmation(input: {
        action: AttendanceConfirmation["action"];
        member: DropdownSearchItem;
        message: string;
        timeoutSeconds: number;
    }) {
        clearAttendanceConfirmationTimers();
        clearAttendanceReminderTimer();
        attendanceReminder = null;
        attendanceConfirmation = {
            action: input.action,
            member: input.member,
            message: input.message,
            timeoutSeconds: input.timeoutSeconds,
            secondsRemaining: input.timeoutSeconds,
        };

        if (input.action !== "checkOut" || input.timeoutSeconds <= 0) {
            return;
        }

        attendanceConfirmationCountdownTimer = setInterval(() => {
            if (!attendanceConfirmation) {
                clearAttendanceConfirmationTimers();
                return;
            }

            attendanceConfirmation = {
                ...attendanceConfirmation,
                secondsRemaining: Math.max(0, attendanceConfirmation.secondsRemaining - 1),
            };
        }, 1000);

        attendanceConfirmationTimer = setTimeout(() => {
            void confirmAttendanceConfirmation();
        }, input.timeoutSeconds * 1000);
    }

    function startAttendanceReminder(input: AttendanceReminder) {
        clearAttendanceReminderTimer();
        clearAttendanceConfirmationTimers();
        attendanceConfirmation = null;
        attendanceReminder = input;

        if (input.timeoutSeconds <= 0) {
            return;
        }

        attendanceReminderTimer = setTimeout(() => {
            closeAttendanceReminder();
        }, input.timeoutSeconds * 1000);
    }

    function closeAttendanceReminder() {
        if (!attendanceReminder) {
            return;
        }

        clearAttendanceReminderTimer();
        attendanceReminder = null;
        void focusAttendanceInput();
    }

    function cancelAttendanceConfirmation() {
        if (!attendanceConfirmation) {
            return;
        }

        clearAttendanceConfirmationTimers();
        const cancelledAction = attendanceConfirmation.action;
        attendanceConfirmation = null;
        toast.info({
            message: cancelledAction === "registerAgain"
                ? m.interestGroupRegisterAgainCancelled()
                : m.interestGroupCheckoutCancelled(),
            duration: 10000,
            position: "bottom-right",
        });
        void focusAttendanceInput();
    }

    async function confirmAttendanceConfirmation() {
        if (!attendanceConfirmation || isSubmitting) {
            return;
        }

        const { action, member } = attendanceConfirmation;
        clearAttendanceConfirmationTimers();
        attendanceConfirmation = null;
        await submitAttendanceAction(action === "checkOut" ? "checkOut" : "check", {
            member,
            forceRegisterAgain: action === "registerAgain",
        });
    }

    function loadMemberOptions(
        query: string,
        context: { limit: number; signal?: AbortSignal },
    ): Promise<{
        options: DropdownSearchItem[];
        exactMatch: DropdownSearchItem | null;
    }> {
        return loadAttendanceMemberOptions(query, context, {
            clientType: memberSearchClientType,
            additionalMemberSearchEndpoint,
            clientCodeLabel: m.clientCode(),
        });
    }

    function attendanceRecordToSearchItem(record: AttendanceRecord): DropdownSearchItem {
        const name = record.chineseName?.trim() || record.englishName?.trim() || record.clientCode;

        return {
            id: record.clientId ?? record.childMemberId ?? record.id,
            value: record.clientCode,
            clientCode: record.clientCode,
            title: name,
            label: name,
            chineseName: record.chineseName,
            englishName: record.englishName,
            param_dict: {
                [m.clientCode()]: record.clientCode,
            },
        };
    }

    function handleDecodedScan(decodedText: string) {
        const result = resolveContinuousScanResult({
            decodedText,
            lastAcceptedScanText,
            lastAcceptedScanAtMs,
            shouldAutoRegisterAfterScan,
            memberSearchStatus,
            isSubmitting,
        });

        if (!result.accepted) {
            return;
        }

        lastAcceptedScanText = result.value;
        lastAcceptedScanAtMs = Date.now();
        memberSearchValue = result.value;
        selectedMember = null;
        memberSearchStatus = "loading";
        startSubmittedAttendanceLookup(result.value);
    }

    function isAttendanceSearchItem(
        item: BaseDropdownSearchItem | null,
    ): item is DropdownSearchItem {
        return typeof item?.clientCode === "string";
    }

    function getAttendanceSearchItemLabel(item: BaseDropdownSearchItem) {
        return typeof item.clientCode === "string" ? item.clientCode : item.label;
    }

    function handleMemberOptionSelect(item: BaseDropdownSearchItem) {
        if (!isAttendanceSearchItem(item)) {
            return;
        }

        memberSearchValue = getAttendanceSearchItemLabel(item);
        selectedMember = item;
        memberSearchStatus = "valid";
        void submitAttendanceAction("check", { member: item });
    }

    function handleMemberSearchEnter(detail: DropdownSearchEnterDetail) {
        detail.event.preventDefault();

        const submittedValue = detail.value.trim();
        if (!submittedValue || isSubmitting || submittedAttendanceLookup) {
            return;
        }

        const member = isAttendanceSearchItem(detail.selectedItem)
            ? detail.selectedItem
            : selectedMember;
        startSubmittedAttendanceLookup(submittedValue);

        if (detail.status === "valid" && member) {
            void submitAttendanceAction("check", { member });
        }
    }

    function handleCameraModeChange(event: Event) {
        const checkbox = event.currentTarget;
        if (!(checkbox instanceof HTMLInputElement)) {
            return;
        }

        scannerInlineOpen = checkbox.checked && hasAttendanceTarget;
        if (!scannerInlineOpen) {
            isScanning = false;
        }
    }

    async function submitAttendanceAction(
        action: "check" | "undo" | "checkOut",
        options: SubmitAttendanceOptions = {},
    ) {
        if (isSubmitting) {
            return;
        }

        const member = options.member ?? selectedMember;
        const requiresValidatedSelection = !options.member;
        const wasSubmittedLookup = Boolean(submittedAttendanceLookup);

        if (
            !hasAttendanceTarget ||
            !member ||
            (requiresValidatedSelection && memberSearchStatus !== "valid")
        ) {
            if (wasSubmittedLookup) {
                await finishAttendanceInputCycle({
                    feedback: {
                        tone: "error",
                        message: requiredMessage,
                    },
                });
            } else {
                feedback = {
                    tone: "error",
                    message: requiredMessage,
                };
            }
            return;
        }

        clearSubmittedAttendanceLookupTimer();
        submittedAttendanceLookup = null;
        isSubmitting = true;
        if (action === "check") {
            startSubmittingOverlayTimer();
        }

        try {
            const endpoint = action === "check"
                ? checkEndpoint
                : action === "checkOut"
                    ? checkoutEndpoint
                    : undoEndpoint;
            if (!endpoint) {
                throw new Error(`Missing attendance endpoint for ${action}`);
            }
            const requestBody: Record<string, string | number | boolean | null> = {
                ...(targetIdKey ? { [targetIdKey]: targetId } : {}),
                client_code: member.clientCode,
            };
            if (options.record) {
                requestBody.attendance_id = options.record.id;
            }
            if (options.forceRegisterAgain === true) {
                requestBody.force_register_again = true;
            }
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            });
            const result = (await response.json()) as AttendanceSubmissionResultPayload & {
                records?: AttendanceRecord[];
                counters?: Record<string, number>;
            };

            records = result.records ?? records;
            counters = result.counters ?? counters;
            const outcome = resolveAttendanceSubmissionOutcome({
                action,
                result,
                hasCheckoutEndpoint: Boolean(checkoutEndpoint),
            });

            if (outcome.kind === "silent") {
                await finishAttendanceInputCycle();
                return;
            }

            if (outcome.kind === "reminder") {
                startAttendanceReminder({
                    message: outcome.message,
                    timeoutSeconds: outcome.timeoutSeconds,
                });
                await finishAttendanceInputCycle({ focus: false });
                return;
            }

            if (outcome.kind === "confirmation") {
                startAttendanceConfirmation({
                    action: outcome.action,
                    member,
                    message: outcome.message,
                    timeoutSeconds: outcome.timeoutSeconds,
                });
                await finishAttendanceInputCycle({ focus: false });
                return;
            }

            await finishAttendanceInputCycle({
                feedback: {
                    tone: outcome.tone,
                    message: outcome.message,
                },
            });
        } catch (error) {
            console.error(error);
            await finishAttendanceInputCycle({
                feedback: {
                    tone: "error",
                    message: m.networkRequestFailed(),
                },
            });
        } finally {
            isSubmitting = false;
            stopSubmittingOverlay();
            if (!attendanceConfirmation && !attendanceReminder) {
                await focusAttendanceInput();
            }
        }
    }

    function canUndoRecord(record: AttendanceRecord): boolean {
        void undoVisibilityTick;
        return getAttendanceUndoRemainingMs({ attendedAt: record.attendedAt }) > 0;
    }

    async function undoAttendanceRecord(record: AttendanceRecord) {
        await submitAttendanceAction("undo", {
            member: attendanceRecordToSearchItem(record),
            record,
        });
    }

    $effect(() => {
        records = initialRecords;
        counters = initialCounters;
    });

    $effect(() => {
        if (!hasAttendanceTarget || (scannerPlacement === "button" && isScanning)) {
            return;
        }

        void focusAttendanceInput();
    });

    $effect(() => {
        if (
            shouldAutoRegisterScannedMember({
                shouldAutoRegisterAfterScan,
                memberSearchStatus,
                hasSelectedMember: Boolean(selectedMember),
                isSubmitting,
            })
        ) {
            shouldAutoRegisterAfterScan = false;
            void submitAttendanceAction("check");
            return;
        }

        if (
            shouldFailSubmittedAttendanceLookup({
                submitIntentActive: Boolean(submittedAttendanceLookup),
                memberSearchStatus,
                isSubmitting,
            })
        ) {
            void finishAttendanceInputCycle({
                feedback: {
                    tone: "error",
                    message: memberSearchStatus === "error"
                        ? m.networkRequestFailed()
                        : m.attendanceInvalidClient(),
                },
            });
            return;
        }

        if (
            !submittedAttendanceLookup &&
            shouldAutoRegisterAfterScan &&
            (memberSearchStatus === "empty" ||
                memberSearchStatus === "invalid" ||
                memberSearchStatus === "error")
        ) {
            shouldAutoRegisterAfterScan = false;
        }
    });

    $effect(() => {
        if (!feedback) {
            return;
        }

        const show = feedback.tone === "success"
            ? toast.success
            : feedback.tone === "warning"
                ? toast.warning
                : toast.error;
        show({ message: feedback.message, duration: 10000, position: "bottom-right" });
    });
</script>

<div class="grid gap-6 xl:grid-cols-[1.15fr_1.4fr]">
    <div class="space-y-6">
        <div class="card ui-panel">
            <div class="card-body space-y-4">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <h2 class="card-title">{m.attendanceActionsTitle()}</h2>
                    {#if actionsHeader}
                        {@render actionsHeader()}
                    {/if}
                </div>

                <div class="rounded-box border border-base-200 bg-base-200/30 p-3">
                    <div class="text-sm font-medium text-base-content/75">
                        {m.attendanceScanMethod()}
                    </div>
                    <div class="mt-2 flex flex-wrap items-center gap-4">
                        <label class="label cursor-default justify-start gap-2 p-0">
                            <input
                                type="checkbox"
                                class="checkbox checkbox-sm"
                                checked
                                disabled
                            />
                            <span class="label-text">{m.attendanceScanMethodScanner()}</span>
                        </label>
                        <label
                            class="label justify-start gap-2 p-0"
                            class:cursor-pointer={hasAttendanceTarget}
                            class:opacity-50={!hasAttendanceTarget}
                            for={cameraModeCheckboxId}
                        >
                            <input
                                id={cameraModeCheckboxId}
                                type="checkbox"
                                class="checkbox checkbox-primary checkbox-sm"
                                checked={scannerInlineOpen}
                                disabled={!hasAttendanceTarget || attendanceInputLocked}
                                onchange={handleCameraModeChange}
                            />
                            <span class="label-text">{m.attendanceScanMethodCamera()}</span>
                        </label>
                    </div>
                </div>

                <div
                    class="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-start"
                >
                    <div class="order-2 w-full md:order-1">
                        {#key attendanceInputResetVersion}
                            <DropdownSearch
                                language={uiLanguage}
                                id={inputId}
                                placeholder={m.attendanceInputPlaceholder()}
                                ariaLabel={m.attendanceInputPlaceholder()}
                                bind:value={memberSearchValue}
                                bind:selectedItem={selectedMember}
                                bind:status={memberSearchStatus}
                                disabled={attendanceInputLocked}
                                limit={8}
                                loadOptions={loadMemberOptions}
                                getItemLabel={getAttendanceSearchItemLabel}
                                onSelect={handleMemberOptionSelect}
                                onEnter={handleMemberSearchEnter}
                                searchOnExternalValueChange={true}
                            />
                        {/key}
                    </div>

                    {#if showInputUndoButton}
                        <div class="order-1 flex gap-3 md:order-2">
                            <button
                                type="button"
                                class="btn btn-outline btn-warning"
                                disabled={memberSearchStatus !== "valid" || attendanceInputLocked}
                                onclick={() => submitAttendanceAction("undo")}
                            >
                                <Undo2 class="h-4 w-4" />
                                {m.attendanceUndo()}
                            </button>
                        </div>
                    {/if}
                </div>

                {#if scannerPlacement === "button" && scannerInlineOpen}
                    <AttendanceScanner
                        readerId={scanReaderId}
                        title={m.attendanceScanTitle()}
                        cameraFailedMessage={m.attendanceCameraFailed()}
                        active={hasAttendanceTarget && scannerInlineOpen && !attendanceInputLocked}
                        showHeader={false}
                        onDecoded={handleDecodedScan}
                        onActiveChange={(active) => {
                            isScanning = active;
                        }}
                        buttonId={scanButtonId}
                    />
                {/if}

                {#if scannerPlacement === "inline"}
                    <AttendanceScanner
                        readerId={scanReaderId}
                        title={m.attendanceScanTitle()}
                        cameraFailedMessage={m.attendanceCameraFailed()}
                        active={hasAttendanceTarget && !attendanceInputLocked}
                        onDecoded={handleDecodedScan}
                        onActiveChange={(active) => {
                            isScanning = active;
                        }}
                        buttonId={scanButtonId}
                    />
                {/if}
            </div>
        </div>

        <AttendanceCounters {counters} {counterDefinitions} />
    </div>

    <div class="min-w-0 self-start">
        <AttendanceRecordsTable
            language={uiLanguage}
            {records}
            {tableTitle}
            {noRecordsMessage}
            {showWalkInBadge}
            {walkInBadgeLabel}
            {showCheckedOutAtColumn}
            {showLatestFsiiSurveyDateColumn}
            {showFsiiSurveyCompletedColumn}
            showUndoColumn={showRowUndoColumn}
            canUndoRecord={canUndoRecord}
            onUndoRecord={undoAttendanceRecord}
            undoDisabled={attendanceInputLocked}
        />
    </div>
</div>

{#if showAttendanceProcessingOverlay}
    <div class="fixed inset-0 z-[80] flex items-center justify-center bg-base-100/35 p-4 backdrop-blur-sm">
        <div class="rounded-box border border-base-200 bg-base-100/95 px-5 py-4 shadow-2xl">
            <div class="flex items-center gap-3 text-base font-semibold text-base-content">
                <span class="loading loading-spinner loading-md text-primary"></span>
                <span>{m.attendanceCheckingIn()}</span>
            </div>
            <div class="mt-2 text-sm text-base-content/70">
                {m.attendanceProcessingScanHint()}
            </div>
        </div>
    </div>
{/if}

<AttendanceDialogs
    reminder={attendanceReminder}
    confirmation={attendanceConfirmation}
    {isSubmitting}
    onCloseReminder={closeAttendanceReminder}
    onConfirm={confirmAttendanceConfirmation}
    onCancel={cancelAttendanceConfirmation}
/>
