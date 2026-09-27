import { cookieMaxAge } from "./paraglide/runtime.js";
import { isStaticAssetPath } from "./static-assets.ts";

export const localeCookieOptions = {
    path: "/",
    sameSite: "lax",
    maxAge: cookieMaxAge,
    // Paraglide's client-side setLocale() updates this preference cookie before reloading.
    httpOnly: false,
} as const;

export function shouldRefreshLocaleCookie(pathname: string): boolean {
    return !isStaticAssetPath(pathname);
}
