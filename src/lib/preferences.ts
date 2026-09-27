import { languageOptions, type SupportedLanguageTag } from "./locale.ts";

export { languageOptions };
export type { SupportedLanguageTag };

export const THEME_STORAGE_KEY = "scsc-theme-preference";

export const themePreferences = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof themePreferences)[number];
export type ResolvedTheme = "light" | "dark";

export function normalizeThemePreference(
    value: string | null | undefined,
): ThemePreference {
    return themePreferences.includes(value as ThemePreference)
        ? (value as ThemePreference)
        : "system";
}

export function resolveTheme(
    preference: ThemePreference,
    systemPrefersDark: boolean,
): ResolvedTheme {
    if (preference === "system") {
        return systemPrefersDark ? "dark" : "light";
    }

    return preference;
}
