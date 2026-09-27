<script lang="ts">
	import { page } from "$app/state";
	import { onMount } from "svelte";
	import { ToastManager } from "@ibobbyts/svelte-ui-utils/toast";
	import { initializeThemePreference } from "$lib/theme";
	import { toSvelteUiLanguage } from "$lib/svelte-ui-language";
	import * as m from "$lib/paraglide/messages";

	import "@ibobbyts/svelte-ui-utils/style.css";
	import "../app.css";

	let { children } = $props();
	const uiLanguage = $derived(toSvelteUiLanguage(page.data.locale as string | undefined));

	onMount(() => initializeThemePreference());
</script>

{@render children()}
<ToastManager language={uiLanguage} closeLabel={m.close()} />
