<script lang="ts">
    import AppHomeCard from "$lib/components/AppHomeCard.svelte";
    import { getHomeSections } from "$lib/app-shell";
    import * as m from "$lib/paraglide/messages";

    const messages = m as unknown as Record<string, (...args: never[]) => string>;

    const sections = $derived(
        getHomeSections().map((section) => ({
            ...section,
            title: messages[section.titleKey]?.() ?? section.titleKey,
            buttons: section.buttons.map((button) => ({
                ...button,
                label: button.label ?? messages[button.labelKey ?? ""]?.() ?? button.labelKey ?? button.id,
            })),
        })),
    );
</script>

<div class="space-y-8">
    <section class="grid gap-6 xl:grid-cols-2">
        {#each sections as section}
            <AppHomeCard
                title={section.title}
                buttons={section.buttons}
                color={section.color}
            />
        {/each}
    </section>
</div>
