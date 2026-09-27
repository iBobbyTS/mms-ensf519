import { USER_PERMISSION_BITS } from "./permissions.ts";

export const REMOTE_SSO_ACCESS_STATUSES = [
    "active",
    "login_disabled",
    "unknown_user",
] as const;

export const SSO_ACCESS_STATUSES = [
    ...REMOTE_SSO_ACCESS_STATUSES,
    "unknown",
] as const;

export type RemoteSsoAccessStatus = (typeof REMOTE_SSO_ACCESS_STATUSES)[number];
export type SsoAccessStatus = (typeof SSO_ACCESS_STATUSES)[number];

const remoteStatusSet = new Set<string>(REMOTE_SSO_ACCESS_STATUSES);
const localStatusSet = new Set<string>(SSO_ACCESS_STATUSES);

export function isRemoteSsoAccessStatus(value: string): value is RemoteSsoAccessStatus {
    return remoteStatusSet.has(value);
}

export function isSsoAccessStatus(value: string): value is SsoAccessStatus {
    return localStatusSet.has(value);
}

export function syncSsoSystemAdminPermission(input: {
    permissions: number;
    accessStatus: SsoAccessStatus;
    appSystemAdmin: boolean;
}): number {
    const permissionsWithoutSystemAdmin =
        input.permissions & ~USER_PERMISSION_BITS.systemAdmin;
    if (input.accessStatus === "active" && input.appSystemAdmin) {
        return permissionsWithoutSystemAdmin | USER_PERMISSION_BITS.systemAdmin;
    }
    return permissionsWithoutSystemAdmin;
}
