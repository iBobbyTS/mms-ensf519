import type { Cookies } from "@sveltejs/kit";

export const PAGE_FLASH_COOKIE = "page_flash";
const PAGE_FLASH_MAX_AGE_SECONDS = 60;

export function setPageFlash(
    cookies: Pick<Cookies, "set">,
    input: { path: string; value: string; secure: boolean },
): void {
    cookies.set(PAGE_FLASH_COOKIE, input.value, {
        path: input.path,
        httpOnly: true,
        sameSite: "lax",
        secure: input.secure,
        maxAge: PAGE_FLASH_MAX_AGE_SECONDS,
    });
}

export function consumePageFlash(
    cookies: Pick<Cookies, "get" | "delete">,
    path: string,
): string | null {
    const value = cookies.get(PAGE_FLASH_COOKIE) ?? null;
    if (value !== null) cookies.delete(PAGE_FLASH_COOKIE, { path });
    return value;
}
