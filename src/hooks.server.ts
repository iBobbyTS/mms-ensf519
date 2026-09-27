import { AsyncLocalStorage } from "node:async_hooks";
import type { Handle, HandleServerError } from "@sveltejs/kit";

import {
    baseLocale,
    cookieName,
    getTextDirection,
    overwriteServerAsyncLocalStorage,
    type Locale,
} from "$lib/paraglide/runtime";
import { localeCookieOptions, shouldRefreshLocaleCookie } from "$lib/locale-cookie";
import { detectLocale } from "$lib/locale";
import { requireSameOriginUnsafeRequest } from "$lib/server/security";

const localeStorage = new AsyncLocalStorage<{
    locale?: Locale;
    origin?: string;
    messageCalls?: Set<string>;
}>();

overwriteServerAsyncLocalStorage(localeStorage);

export const handle: Handle = async ({ event, resolve }) => {
    const locale = detectLocale({
        cookieLocale: event.cookies.get(cookieName),
        acceptLanguage: event.request.headers.get("accept-language"),
    }) ?? baseLocale;
    const direction = getTextDirection(locale);
    const pathname = event.url.pathname;
    const shouldRefreshLocale = shouldRefreshLocaleCookie(pathname);

    requireSameOriginUnsafeRequest(event);

    if (shouldRefreshLocale) {
        event.cookies.set(cookieName, locale, localeCookieOptions);
    }

    event.locals.locale = locale;

    return localeStorage.run(
        {
            locale,
            origin: event.url.origin,
            messageCalls: new Set(),
        },
        async () =>
            resolve(event, {
                transformPageChunk: ({ html }) =>
                    html
                        .replace("%paraglide.lang%", locale)
                        .replace("%paraglide.textDirection%", direction),
            }),
    );
};

export const handleError: HandleServerError = ({ error, event }) => {
    console.error("Unhandled server error", {
        pathname: event.url.pathname,
        error,
    });

    return {
        message: "Internal Server Error",
    };
};
