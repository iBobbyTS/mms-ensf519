<script lang="ts">
    import { goto } from "$app/navigation";
    import { UserPlus } from "lucide-svelte";

    import type { ClientDataSource } from "$lib/client-form";
    import ClientForm from "$lib/components/ClientForm.svelte";
    import * as m from "$lib/paraglide/messages";

    let {
        form,
        title,
        description,
        initialClient,
        cancelHref,
    } : {
        form?: { error?: string } | null;
        title: string;
        description: string;
        initialClient?: ClientDataSource;
        cancelHref: string;
    } = $props();

    let errorMessage = $state<string | null>(null);
    const createFormId = "client-create-form";

    async function handleMemberSubmit(formData: FormData) {
        errorMessage = null;
        try {
            const response = await fetch("?", {
                method: "POST",
                body: formData,
            });

            if (response.redirected) {
                window.location.href = response.url;
                return;
            }

            const result = (await response.json()) as {
                type?: string;
                location?: string;
                data?: { error?: string };
                error?: { message?: string };
            };

            if (result.type === "redirect" && result.location) {
                window.location.href = result.location;
            } else if (result.type === "failure" || result.type === "error") {
                errorMessage = result.data?.error || result.error?.message || m.unknownError();
            } else if (result.type === "success") {
                goto(cancelHref);
            }
        } catch (e) {
            errorMessage = m.networkRequestFailed();
            console.error(e);
        }
    }
</script>

<div class="space-y-6">
    <div>
        <h1 class="page-title">
            <UserPlus class="page-title-icon" />
            {title}
        </h1>
        {#if description}
            <p class="mt-2 text-sm text-base-content/60">{description}</p>
        {/if}
        <div class="ui-action-row ui-action-row--floating">
            <a href={cancelHref} class="btn btn-ghost btn-sm">{m.cancel()}</a>
            <button type="submit" form={createFormId} class="btn btn-primary btn-sm">{m.save()}</button>
        </div>
    </div>

    {#if errorMessage || form?.error}
        <div class="alert alert-error">
            <span>{errorMessage || form?.error}</span>
        </div>
    {/if}

    <ClientForm
        formId={createFormId}
        client={initialClient}
        mode="add"
        onsubmit={handleMemberSubmit}
        oncancel={() => goto(cancelHref)}
    />
</div>
