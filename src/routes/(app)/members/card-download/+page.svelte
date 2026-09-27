<script lang="ts">
    import { Download } from "lucide-svelte";
    import * as m from "$lib/paraglide/messages";
    let input = $state("");
    let errorMessage = $state<string | null>(null);
    let submitting = $state(false);

    async function download() {
        errorMessage = null;
        submitting = true;
        try {
            const response = await fetch("/api/members/card-download", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input }) });
            if (!response.ok) {
                const body = await response.json().catch(() => ({})) as { error?: string; missing?: string[]; disabled?: string[]; expired?: string[] };
                if (body.error === "member_status") {
                    errorMessage = [
                        body.missing?.length ? `${m.memberCardCsvMissing()}: ${body.missing.join(", ")}` : "",
                        body.disabled?.length ? `${m.memberCardCsvDisabled()}: ${body.disabled.join(", ")}` : "",
                        body.expired?.length ? `${m.memberCardCsvExpired()}: ${body.expired.join(", ")}` : "",
                    ].filter(Boolean).join("\n");
                } else {
                    errorMessage = m.memberCardCsvInvalid();
                }
                return;
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "member-cards.csv";
            anchor.click();
            URL.revokeObjectURL(url);
        } catch {
            errorMessage = m.networkRequestFailed();
        } finally {
            submitting = false;
        }
    }
</script>

<div class="space-y-6">
    <div class="page-header"><div><h1 class="page-title"><Download class="page-title-icon" />{m.memberCardCsvTitle()}</h1><p class="page-description">{m.memberCardCsvDescription()}</p></div></div>
    <form class="flex max-w-2xl flex-col gap-6" onsubmit={(event) => { event.preventDefault(); void download(); }}>
        <label class="form-control flex w-full flex-col gap-2"><span class="label-text">{m.memberCardCsvInputLabel()}</span><input class="input input-bordered w-full" bind:value={input} placeholder={m.memberCardCsvPlaceholder()} /></label>
        {#if errorMessage}<p class="whitespace-pre-line text-error" role="alert">{errorMessage}</p>{/if}
        <button class="btn btn-primary" type="submit" disabled={submitting}><Download class="h-4 w-4" />{submitting ? m.memberCardCsvPreparing() : m.memberCardCsvDownload()}</button>
    </form>
</div>
