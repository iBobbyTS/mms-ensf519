<script lang="ts">
    import { QrCode } from "lucide-svelte";
    import { onDestroy, tick, untrack } from "svelte";

    let {
        readerId,
        title,
        cameraFailedMessage,
        active = false,
        framed = true,
        showHeader = true,
        onDecoded,
        onActiveChange,
        buttonId,
    } : {
        readerId: string;
        title: string;
        cameraFailedMessage: string;
        active?: boolean;
        framed?: boolean;
        showHeader?: boolean;
        onDecoded: (decodedText: string) => void;
        onActiveChange?: (active: boolean) => void;
        buttonId?: string;
    } = $props();

    let html5QrCode: any = null;
    let isScanning = $state(false);
    let isStarting = $state(false);
    let scanErrorMessage = $state("");
    let lifecycleToken = 0;
    const scannerQrboxScale = 0.66;

    function resolveScannerQrbox(viewfinderWidth: number, viewfinderHeight: number) {
        const shortestSide = Math.min(viewfinderWidth, viewfinderHeight);
        const maxEdge = Math.max(80, shortestSide - 24);
        const preferredEdge = Math.max(120, Math.floor(shortestSide * scannerQrboxScale));
        const edge = Math.min(preferredEdge, maxEdge);

        return { width: edge, height: edge };
    }

    function setScanning(nextActive: boolean) {
        isScanning = nextActive;
        onActiveChange?.(nextActive);
    }

    async function start() {
        if (isScanning || isStarting) {
            return;
        }

        const token = ++lifecycleToken;
        isStarting = true;
        scanErrorMessage = "";
        await tick();
        const { Html5Qrcode } = await import("html5-qrcode");

        setTimeout(() => {
            if (token !== lifecycleToken) {
                isStarting = false;
                return;
            }

            html5QrCode = new Html5Qrcode(readerId);
            html5QrCode
                .start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: resolveScannerQrbox,
                        aspectRatio: 1,
                    },
                    (decodedText: string) => {
                        onDecoded(decodedText);
                    },
                    () => {},
                )
                .then(() => {
                    if (token !== lifecycleToken) {
                        stop();
                        return;
                    }

                    setScanning(true);
                })
                .catch((error: unknown) => {
                    console.error(error);
                    setScanning(false);
                    scanErrorMessage = cameraFailedMessage;
                })
                .finally(() => {
                    if (token === lifecycleToken) {
                        isStarting = false;
                    }
                });
        }, 80);
    }

    function stop() {
        lifecycleToken += 1;
        isStarting = false;

        if (html5QrCode?.isScanning) {
            const scanner = html5QrCode;
            html5QrCode = null;
            scanner.stop().finally(() => {
                scanner.clear();
                setScanning(false);
            });
            return;
        }

        html5QrCode?.clear?.();
        html5QrCode = null;
        setScanning(false);
    }

    $effect(() => {
        const shouldBeActive = active;
        const hasError = Boolean(scanErrorMessage);

        untrack(() => {
            if (shouldBeActive && !hasError) {
                void start();
                return;
            }

            if (!shouldBeActive) {
                stop();
            }
        });
    });

    onDestroy(() => {
        stop();
    });
</script>

<div class={framed ? "space-y-3 rounded-box border border-base-200 bg-base-200/30 p-4" : "space-y-3"}>
    {#if showHeader}
        <div class="flex items-center justify-between gap-3">
            <h3 class="flex items-center gap-2 font-semibold">
                <QrCode class="h-4 w-4" />
                {title}
            </h3>
            {#if !isScanning && !isStarting}
                <button
                    id={buttonId}
                    type="button"
                    class="btn btn-circle btn-ghost btn-sm"
                    aria-label={title}
                    title={title}
                    onclick={start}
                >
                    <QrCode class="h-4 w-4" />
                </button>
            {/if}
        </div>
    {/if}

    <div class="flex justify-center">
        <div
            id={readerId}
            class="member-attendance-scanner aspect-square w-full max-w-md overflow-hidden rounded-box bg-black"
        ></div>
    </div>
    {#if scanErrorMessage}
        <p class="text-sm text-error">{scanErrorMessage}</p>
    {/if}
</div>

<style>
    :global(.member-attendance-scanner) {
        position: relative;
        background: #000;
    }

    :global(.member-attendance-scanner > div) {
        width: 100% !important;
        height: 100% !important;
    }

    :global(.member-attendance-scanner [id$="__scan_region"]) {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        overflow: hidden !important;
    }

    :global(.member-attendance-scanner video) {
        display: block;
        width: 100% !important;
        height: 100% !important;
        min-width: 100%;
        min-height: 100%;
        object-fit: cover;
        object-position: center;
    }

    :global(.member-attendance-scanner canvas) {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover;
        object-position: center;
    }
</style>
