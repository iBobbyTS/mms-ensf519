<script lang="ts">
    import { page } from "$app/state";
    import { Dropdown, type DropdownOption, type DropdownValue } from "@ibobbyts/svelte-ui-utils/dropdown";
    import { onMount } from "svelte";
    import { ArrowLeft } from "lucide-svelte";

    import { scheduleAttendanceFocusRestore } from "$lib/attendance-focus";
    import { formatMmsTitle, getLogicalBackRoute, getPageTitleKey, isFullWidthPage } from "$lib/app-shell";
    import { setLanguage } from "$lib/i18n";
    import * as m from "$lib/paraglide/messages";
    import {
        type SupportedLanguageTag,
        type ThemePreference,
    } from "$lib/preferences";
    import { setThemePreference, themePreference } from "$lib/theme";

    let { children } = $props();

    const currentLanguage = $derived(page.data.locale as SupportedLanguageTag);
    const messages = m as unknown as Record<string, (...args: never[]) => string>;
    function message(key: string, fallback: string) {
        return messages[key]?.() ?? fallback;
    }
    function clientDisplayName() {
        const client = (page.data as {
            client?: {
                chineseName?: string | null;
                englishName?: string | null;
                clientCode?: string | null;
            };
        }).client;

        return client?.chineseName || client?.englishName || client?.clientCode || "";
    }
    const pageTitle = $derived.by(() => {
        const title = message(getPageTitleKey(page.url.pathname), message("homeTitle", "Home"));
        const name = clientDisplayName();

        if (name && /^\/members\/[^/]+(?:\/edit)?$/.test(page.url.pathname)) {
            return `${title} - ${name}`;
        }

        return title;
    });
    const logicalBackRoute = $derived(getLogicalBackRoute(page.url.pathname));
    const backHref = $derived(logicalBackRoute?.href ?? null);
    const backLabel = $derived(
        logicalBackRoute ? message(logicalBackRoute.labelKey, message("returnBtn", "Return")) : "",
    );
    const fullWidthPage = $derived(isFullWidthPage(page.url.pathname));
    const themeOptions = $derived<DropdownOption[]>([
        { value: "dark", label: message("themeDark", "Dark mode") },
        { value: "light", label: message("themeLight", "Light mode") },
        { value: "system", label: message("themeSystem", "Follow system") },
    ]);
    const languageDropdownOptions = $derived<DropdownOption[]>([
        { value: "en", label: getLanguageLabel("en") },
        { value: "zh-cn", label: getLanguageLabel("zh-cn") },
        { value: "zh-tw", label: getLanguageLabel("zh-tw") },
    ]);

    let selectedTheme = $state<ThemePreference>("system");

    function getLanguageLabel(languageTag: SupportedLanguageTag) {
        switch (languageTag) {
            case "zh-cn":
                return message("languageSimplifiedChinese", "Chinese (Simplified)");
            case "zh-tw":
                return message("languageTraditionalChinese", "Chinese (Traditional)");
            default:
                return message("languageEnglish", "English");
        }
    }

    async function handleLanguageChange(languageTag: SupportedLanguageTag) {
        await setLanguage(languageTag);
    }

    function handleThemeChange(preference: ThemePreference) {
        setThemePreference(preference);
    }

    function handleThemeDropdownChange(value: DropdownValue) {
        handleThemeChange(String(value) as ThemePreference);
        scheduleAttendanceFocusRestore();
    }

    function handleLanguageDropdownChange(value: DropdownValue) {
        scheduleAttendanceFocusRestore();
        void handleLanguageChange(String(value) as SupportedLanguageTag);
    }

    onMount(() => {
        let navbarDropdownInteractionActive = false;
        const navbarDropdownSelector = ".nav-dropdown--theme, .nav-dropdown--language";
        const unsubscribeTheme = themePreference.subscribe((value) => {
            selectedTheme = value;
        });

        const handleDocumentPointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }

            const navbarDropdown = target.closest(navbarDropdownSelector);
            if (!navbarDropdown) {
                if (navbarDropdownInteractionActive) {
                    navbarDropdownInteractionActive = false;
                    scheduleAttendanceFocusRestore();
                }
                return;
            }

            navbarDropdownInteractionActive = true;

            const button = navbarDropdown.querySelector(".suu-dropdown__button");
            const isClosingFromButton = Boolean(
                target.closest(".suu-dropdown__button") &&
                    button?.getAttribute("aria-expanded") === "true",
            );
            const isSelectingOption = Boolean(target.closest(".suu-dropdown__option"));

            if (isClosingFromButton || isSelectingOption) {
                navbarDropdownInteractionActive = false;
                scheduleAttendanceFocusRestore();
            }
        };

        document.addEventListener("pointerdown", handleDocumentPointerDown, true);

        return () => {
            unsubscribeTheme();
            document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
        };
    });

</script>

<svelte:head>
    <title>{formatMmsTitle(pageTitle)}</title>
</svelte:head>

<div class="min-h-screen bg-base-200 flex flex-col pt-16" style="--suu-table-sticky-top: var(--app-navbar-height)">
    <div class="navbar bg-base-100 shadow-sm fixed inset-x-0 top-0 z-50">
        <div class="navbar-start min-w-0 gap-1 sm:gap-2">
            <a
                href="/home"
                class="btn btn-ghost text-base sm:text-xl px-2 sm:px-4"
            >
                {message("appBrand", "SCSC Membership System")}
            </a>
            {#if backHref}
                <a
                    href={backHref}
                    class="btn btn-ghost btn-sm rounded-btn px-2 sm:px-3"
                    aria-label={backLabel}
                    title={backLabel}
                >
                    <ArrowLeft class="h-4 w-4" />
                    <span class="hidden sm:inline">{backLabel}</span>
                </a>
            {/if}
        </div>

        <div class="navbar-center min-w-0 flex-1 px-2">
            <h1 class="truncate text-sm sm:text-lg font-semibold text-center">
                {pageTitle}
            </h1>
        </div>

        <div class="navbar-end gap-2">
            <div class="nav-dropdown nav-dropdown--theme flex items-center">
                <Dropdown
                    ariaLabel={message("themeLabel", "Theme")}
                    value={selectedTheme}
                    options={themeOptions}
                    onChange={handleThemeDropdownChange}
                />
            </div>

            <div class="nav-dropdown nav-dropdown--language flex items-center">
                <Dropdown
                    ariaLabel={message("languageLabel", "Language")}
                    value={currentLanguage}
                    options={languageDropdownOptions}
                    onChange={handleLanguageDropdownChange}
                />
            </div>
        </div>
    </div>

    <main
        class="flex-grow p-4 md:p-8 w-full mx-auto"
        class:max-w-7xl={!fullWidthPage}
        class:max-w-none={fullWidthPage}
    >
        {@render children()}
    </main>
</div>

<style>
    .nav-dropdown {
        --suu-dropdown-space: 0.625rem;
    }

    .nav-dropdown :global(.suu-dropdown__button) {
        height: 2rem;
        font-size: 0.75rem;
    }

    @media (min-width: 640px) {
        .nav-dropdown :global(.suu-dropdown__button) {
            height: 2.25rem;
            font-size: 0.875rem;
        }
    }
</style>
