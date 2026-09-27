import { baseLocale, locales, type Locale } from "./paraglide/runtime.js";

export const languageOptions = [...locales] as const;
export type SupportedLanguageTag = Locale;

export function normalizeLocale(value: string | null | undefined): Locale | null {
    if (!value) {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    if ((locales as readonly string[]).includes(normalized)) {
        return normalized as Locale;
    }

    const matchedByLanguage = (locales as readonly string[]).find((locale) => {
        const localeLanguage = locale.split("-")[0];
        return normalized === localeLanguage || normalized.startsWith(`${localeLanguage}-`);
    });

    return (matchedByLanguage as Locale | undefined) ?? null;
}

export function detectLocale(input: {
    cookieLocale?: string | null;
    acceptLanguage?: string | null;
}): Locale {
    const fromCookie = normalizeLocale(input.cookieLocale);
    if (fromCookie) {
        return fromCookie;
    }

    const fromHeader = parseAcceptLanguage(input.acceptLanguage);
    if (fromHeader) {
        return fromHeader;
    }

    return baseLocale;
}

function parseAcceptLanguage(value: string | null | undefined): Locale | null {
    if (!value) {
        return null;
    }

    const entries = value
        .split(",")
        .map((entry) => {
            const [tag, ...params] = entry.trim().split(";");
            const qValue = params
                .map((param) => param.trim())
                .find((param) => param.startsWith("q="))
                ?.slice(2);
            const weight = Number(qValue);

            return {
                tag,
                weight: Number.isFinite(weight) ? weight : 1,
            };
        })
        .filter((entry) => entry.tag.length > 0)
        .sort((left, right) => right.weight - left.weight);

    for (const entry of entries) {
        const locale = normalizeLocale(entry.tag);
        if (locale) {
            return locale;
        }
    }

    return null;
}
