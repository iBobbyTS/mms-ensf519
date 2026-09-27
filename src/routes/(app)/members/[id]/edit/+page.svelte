<script lang="ts">
    import { goto } from "$app/navigation";
    import { Pencil } from "lucide-svelte";

    import ClientForm from "$lib/components/ClientForm.svelte";
    import * as m from "$lib/paraglide/messages";
    import type { ActionData, PageData } from "./$types";

    let { data, form } : { data: PageData; form: ActionData } = $props();

    const mode = "edit";
    const formData = $derived(data.client);
    const detailHref = $derived(`/members/${data.client.clientCode}`);
    const editFormId = "client-edit-form";
    const legalName = $derived(`${data.client.firstName} ${data.client.lastName}`.trim());
    const displayName = $derived(
        data.client.chineseName || legalName || data.client.clientCode,
    );

    async function handleUpdateSubmit(submittedData: FormData) {
        const response = await fetch("?/update", {
            method: "POST",
            body: submittedData,
        });

        if (response.redirected) {
            window.location.href = response.url;
            return;
        }

        const result = (await response.json()) as {
            type?: string;
            location?: string;
        };

        if (result.type === "redirect" && result.location) {
            window.location.href = result.location;
        }
    }
</script>

<div class="space-y-6">
    <div class="page-header">
        <h1 class="page-title">
            <Pencil class="page-title-icon" />
            {m.editClient()}
        </h1>
        <p class="mt-2 text-sm text-base-content/60">
            {displayName} · {data.client.clientCode}
        </p>
        <div class="ui-action-row ui-action-row--floating">
            <a href={detailHref} class="btn btn-outline btn-sm">
                {m.cancel()}
            </a>
            <button type="submit" form={editFormId} class="btn btn-primary btn-sm">
                {m.update()}
            </button>
        </div>
    </div>

    {#if form?.error}
        <div class="alert alert-error">
            <span>{form.error}</span>
        </div>
    {/if}

    <ClientForm
        formId={editFormId}
        client={formData}
        {mode}
        onsubmit={handleUpdateSubmit}
        oncancel={() => goto(detailHref)}
    />
</div>
