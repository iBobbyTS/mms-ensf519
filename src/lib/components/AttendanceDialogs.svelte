<script lang="ts">
    import { ConfirmDialog, Dialog } from "@ibobbyts/svelte-ui-utils/dialog";

    import type {
        AttendanceConfirmation,
        AttendanceReminder,
    } from "$lib/attendance-panel";
    import * as m from "$lib/paraglide/messages";

    let {
        reminder,
        confirmation,
        isSubmitting,
        onCloseReminder,
        onConfirm,
        onCancel,
    } : {
        reminder: AttendanceReminder | null;
        confirmation: AttendanceConfirmation | null;
        isSubmitting: boolean;
        onCloseReminder: () => void;
        onConfirm: () => void | Promise<void>;
        onCancel: () => void;
    } = $props();

    const hasReminder = $derived(Boolean(reminder));
    const hasConfirmation = $derived(Boolean(confirmation));
    const confirmationIsTimedCheckout = $derived(
        confirmation?.action === "checkOut" && confirmation.timeoutSeconds > 0,
    );
    const confirmationIsRegisterAgain = $derived(confirmation?.action === "registerAgain");
    const confirmationTitle = $derived(
        confirmationIsRegisterAgain
            ? m.interestGroupDuplicateCheckInDialogTitle()
            : confirmation?.message ?? "",
    );
    const confirmationBodyMessage = $derived(
        confirmationIsTimedCheckout && confirmation
            ? m.interestGroupCheckoutAutoCountdown({
                seconds: confirmation.secondsRemaining,
            })
            : confirmationIsRegisterAgain
                ? confirmation?.message ?? ""
                : "",
    );
    const confirmationCountdownDurationMs = $derived(
        confirmationIsTimedCheckout ? (confirmation?.timeoutSeconds ?? 0) * 1000 : 0,
    );
    const confirmationConfirmLabel = $derived(
        confirmation?.action === "registerAgain"
            ? m.interestGroupRegisterAgainConfirm()
            : m.attendanceCheckOut(),
    );
    const reminderCountdownDurationMs = $derived((reminder?.timeoutSeconds ?? 0) * 1000);
</script>

<Dialog
    open={hasReminder}
    title={m.interestGroupDuplicateCheckInDialogTitle()}
    closeLabel={m.close()}
    size="sm"
    dismissible={true}
    closeOnBackdrop={true}
    closeOnEscape={true}
    blurBackdrop={true}
    showCountdown={hasReminder}
    countdownDurationMs={reminderCountdownDurationMs}
    countdownLabel={reminder?.message ?? ""}
    onClose={onCloseReminder}
>
    <p class="text-base font-medium text-base-content/75">
        {reminder?.message ?? ""}
    </p>
</Dialog>

<ConfirmDialog
    open={hasConfirmation}
    title={confirmationTitle}
    message={confirmationBodyMessage}
    confirmLabel={confirmationConfirmLabel}
    cancelLabel={m.cancel()}
    closeLabel={m.cancel()}
    confirmDisabled={isSubmitting}
    cancelDisabled={isSubmitting}
    dismissible={!isSubmitting}
    closeOnBackdrop={!isSubmitting}
    closeOnEscape={!isSubmitting}
    blurBackdrop={true}
    showCountdown={confirmationIsTimedCheckout}
    countdownDurationMs={confirmationCountdownDurationMs}
    countdownLabel={confirmationBodyMessage}
    onConfirm={onConfirm}
    onClose={onCancel}
/>
