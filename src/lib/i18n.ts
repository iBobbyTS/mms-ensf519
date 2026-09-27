import { setLocale, type Locale } from "$lib/paraglide/runtime";

export function setLanguage(locale: Locale, options?: { reload?: boolean }) {
    return setLocale(locale, options);
}
