import { browser } from "$app/environment";
import { get, writable } from "svelte/store";

import {
    THEME_STORAGE_KEY,
    normalizeThemePreference,
    resolveTheme,
    type ThemePreference,
    type ResolvedTheme,
} from "$lib/preferences";

export const themePreference = writable<ThemePreference>("system");

let initialized = false;
let cleanupTheme: (() => void) | undefined;

export function applyThemePreference(
    preference: ThemePreference,
    systemPrefersDark = false,
): ResolvedTheme {
    const resolvedTheme = resolveTheme(preference, systemPrefersDark);

    if (browser) {
        document.documentElement.dataset.theme = resolvedTheme;
        document.documentElement.style.colorScheme = resolvedTheme;
    }

    return resolvedTheme;
}

export function setThemePreference(preference: ThemePreference): void {
    themePreference.set(preference);

    if (browser) {
        window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
}

export function initializeThemePreference(): () => void {
    if (!browser) {
        return () => {};
    }

    if (initialized && cleanupTheme) {
        return cleanupTheme;
    }

    initialized = true;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const storedPreference = normalizeThemePreference(
        window.localStorage.getItem(THEME_STORAGE_KEY),
    );

    themePreference.set(storedPreference);
    applyThemePreference(storedPreference, mediaQuery.matches);

    const unsubscribe = themePreference.subscribe((preference) => {
        window.localStorage.setItem(THEME_STORAGE_KEY, preference);
        applyThemePreference(preference, mediaQuery.matches);
    });

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
        if (get(themePreference) === "system") {
            applyThemePreference("system", event.matches);
        }
    };

    const handleStorage = (event: StorageEvent) => {
        if (event.key === THEME_STORAGE_KEY) {
            themePreference.set(normalizeThemePreference(event.newValue));
        }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    window.addEventListener("storage", handleStorage);

    cleanupTheme = () => {
        unsubscribe();
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
        window.removeEventListener("storage", handleStorage);
        initialized = false;
        cleanupTheme = undefined;
    };

    return cleanupTheme;
}
