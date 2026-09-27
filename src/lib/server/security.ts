import { error } from "@sveltejs/kit";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isUnsafeMethod(method: string): boolean {
    return UNSAFE_METHODS.has(method.toUpperCase());
}

export function isSameOriginUnsafeRequest(
    method: string,
    url: URL,
    headers: Headers,
): boolean {
    if (!isUnsafeMethod(method)) return true;

    const origin = headers.get("origin");
    if (origin) {
        return origin === url.origin;
    }

    const referer = headers.get("referer");
    if (!referer) return false;

    try {
        return new URL(referer).origin === url.origin;
    } catch {
        return false;
    }
}

export function requireSameOriginUnsafeRequest(event: {
    request: Request;
    url: URL;
}): void {
    if (!isSameOriginUnsafeRequest(event.request.method, event.url, event.request.headers)) {
        throw error(403, "Forbidden");
    }
}

// Authentication and permission tiers were removed in this extract: every
// visitor has full access, so these guards are no-ops kept for call sites.
export function requireSystemAdmin(_locals: App.Locals): void {}

export function requireAdminAccess(_locals: App.Locals): void {}

export function requireAttendanceAccess(_locals: App.Locals): void {}
