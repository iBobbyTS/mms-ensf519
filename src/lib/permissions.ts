export const USER_PERMISSION_BITS = {
    systemAdmin: 1,
    admin: 2,
    attendanceTaker: 4,
} as const;

export type UserPermissionKey = keyof typeof USER_PERMISSION_BITS;

export const USER_PERMISSION_ORDER: UserPermissionKey[] = [
    "systemAdmin",
    "admin",
    "attendanceTaker",
];

export const DEFAULT_USER_PERMISSIONS = 0;
export const ALL_USER_PERMISSIONS =
    USER_PERMISSION_BITS.systemAdmin |
    USER_PERMISSION_BITS.admin |
    USER_PERMISSION_BITS.attendanceTaker;

export function isValidUserPermissions(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= ALL_USER_PERMISSIONS &&
        (value & ~ALL_USER_PERMISSIONS) === 0
    );
}

export function normalizeUserPermissions(
    value: unknown,
    fallback = DEFAULT_USER_PERMISSIONS,
): number {
    if (typeof value === "string" && value.trim() !== "") {
        const numericValue = Number(value);
        return isValidUserPermissions(numericValue) ? numericValue : fallback;
    }
    return isValidUserPermissions(value) ? value : fallback;
}

export function hasPermissionBit(permissions: number | null | undefined, bit: number): boolean {
    return typeof permissions === "number" && (permissions & bit) === bit;
}

export function hasSystemAdminAccess(permissions: number | null | undefined): boolean {
    return hasPermissionBit(permissions, USER_PERMISSION_BITS.systemAdmin);
}

export function hasAdminAccess(permissions: number | null | undefined): boolean {
    return (
        hasSystemAdminAccess(permissions) ||
        hasPermissionBit(permissions, USER_PERMISSION_BITS.admin)
    );
}

export function hasAttendanceAccess(permissions: number | null | undefined): boolean {
    return (
        hasSystemAdminAccess(permissions) ||
        hasPermissionBit(permissions, USER_PERMISSION_BITS.admin) ||
        hasPermissionBit(permissions, USER_PERMISSION_BITS.attendanceTaker)
    );
}

export function describeUserPermissionKeys(permissions: number): UserPermissionKey[] {
    return USER_PERMISSION_ORDER.filter((key) =>
        hasPermissionBit(permissions, USER_PERMISSION_BITS[key]),
    );
}

export function permissionsFromKeys(keys: Iterable<UserPermissionKey>): number {
    let permissions = 0;
    for (const key of keys) {
        permissions |= USER_PERMISSION_BITS[key];
    }
    return permissions;
}
