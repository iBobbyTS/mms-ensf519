<script lang="ts">
    import ClientCreatePage from "$lib/components/ClientCreatePage.svelte";
    import * as m from "$lib/paraglide/messages";
    import type { ActionData } from "./$types";

    let { form } : { form: ActionData } = $props();
</script>

<ClientCreatePage
    {form}
    title={m.memberAddPageTitle()}
    description={m.memberAddPageDescription()}
    initialClient={{ clientType: "Member" }}
    cancelHref="/members"
/>
