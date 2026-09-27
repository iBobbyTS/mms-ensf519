<script lang="ts">
    import AttendanceScanner from "$lib/components/AttendanceScanner.svelte";

    let {
        open = false,
        readerId,
        title,
        cameraFailedMessage,
        onDecoded,
        onOpenChange,
        onActiveChange,
    } : {
        open?: boolean;
        readerId: string;
        title: string;
        cameraFailedMessage: string;
        onDecoded: (decodedText: string) => void;
        onOpenChange?: (open: boolean) => void;
        onActiveChange?: (active: boolean) => void;
    } = $props();

    let visible = $state(false);

    function setVisible(nextVisible: boolean) {
        visible = nextVisible;
        onOpenChange?.(nextVisible);
    }

    function closeDialog() {
        setVisible(false);
    }

    $effect(() => {
        visible = open;
    });
</script>

{#if visible}
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
        <div class="w-full max-w-lg overflow-hidden rounded-box bg-base-100 shadow-xl">
            <div class="flex items-center justify-between border-b p-4">
                <h3 class="font-bold">{title}</h3>
                <button type="button" class="btn btn-circle btn-ghost btn-sm" onclick={closeDialog}>
                    x
                </button>
            </div>
            <div class="bg-black p-4">
                <AttendanceScanner
                    {readerId}
                    {title}
                    {cameraFailedMessage}
                    active={visible}
                    framed={false}
                    showHeader={false}
                    {onDecoded}
                    {onActiveChange}
                />
            </div>
        </div>
    </div>
{/if}
