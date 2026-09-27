<script lang="ts">
    import ClientDirectoryPage from "$lib/components/ClientDirectoryPage.svelte";
    import * as m from "$lib/paraglide/messages";
    import type { PageData } from "./$types";

    let { data } : { data: PageData } = $props();
</script>

<ClientDirectoryPage
    {data}
    title={m.memberDirectoryPageTitle()}
    description={m.memberDirectoryPageDescription()}
    addHref="/members/add"
    addLabel={m.memberAddPageTitle()}
    secondaryHref="/members/card-download"
    secondaryLabel={m.memberCardCsvTitle()}
    clearHref="/members"
/>
