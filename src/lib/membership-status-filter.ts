const TOKENS = new Set(["active", "warning", "expired", "lifetime", "disabled"]);
const NONE_SENTINEL = "none";

export type MembershipStatusFilter = {
    includeActive: boolean;
    includeWarning: boolean;
    includeExpired: boolean;
    includeLifetime: boolean;
    includeDisabled: boolean;
};

export const DEFAULT_MEMBERSHIP_STATUS_FILTER: MembershipStatusFilter = {
    includeActive: true,
    includeWarning: true,
    includeExpired: true,
    includeLifetime: true,
    includeDisabled: false,
};

export function isDefaultMembershipStatusFilter(
    f: MembershipStatusFilter,
): boolean {
    return (
        f.includeActive &&
        f.includeWarning &&
        f.includeExpired &&
        f.includeLifetime &&
        !f.includeDisabled
    );
}

export function isEmptyMembershipStatusFilter(
    f: MembershipStatusFilter,
): boolean {
    return (
        !f.includeActive &&
        !f.includeWarning &&
        !f.includeExpired &&
        !f.includeLifetime &&
        !f.includeDisabled
    );
}

export function membershipStatusFilterValues(f: MembershipStatusFilter): string[] {
    return [
        ...(f.includeActive ? ["active"] : []),
        ...(f.includeWarning ? ["warning"] : []),
        ...(f.includeExpired ? ["expired"] : []),
        ...(f.includeLifetime ? ["lifetime"] : []),
        ...(f.includeDisabled ? ["disabled"] : []),
    ];
}

export function membershipStatusFromFilterValue(value: unknown): MembershipStatusFilter {
    const selected = new Set(Array.isArray(value) ? value.map(String) : []);
    return {
        includeActive: selected.has("active"),
        includeWarning: selected.has("warning"),
        includeExpired: selected.has("expired"),
        includeLifetime: selected.has("lifetime"),
        includeDisabled: selected.has("disabled"),
    };
}

export function sameMembershipStatusFilter(
    left: MembershipStatusFilter,
    right: MembershipStatusFilter,
): boolean {
    return (
        left.includeActive === right.includeActive &&
        left.includeWarning === right.includeWarning &&
        left.includeExpired === right.includeExpired &&
        left.includeLifetime === right.includeLifetime
        && left.includeDisabled === right.includeDisabled
    );
}

/**
 * 解析 `mstat` 查询：
 * - `null` 或空串 → 默认四项全选（未显式筛选）
 * - `none` → 明确全部未选
 * - 含有 token 的逗号列表 → 相应子集；无有效 token 时回退为默认全选
 */
export function parseMstatParam(value: string | null): MembershipStatusFilter {
    if (value == null || value.trim() === "") {
        return { ...DEFAULT_MEMBERSHIP_STATUS_FILTER };
    }
    const trimmed = value.trim().toLowerCase();
    if (trimmed === NONE_SENTINEL) {
        return {
            includeActive: false,
            includeWarning: false,
            includeExpired: false,
            includeLifetime: false,
            includeDisabled: false,
        };
    }
    const parts = trimmed
        .split(",")
        .map((s) => s.trim())
        .filter((s) => TOKENS.has(s));
    if (parts.length === 0) {
        return { ...DEFAULT_MEMBERSHIP_STATUS_FILTER };
    }
    const set = new Set(parts);
    return {
        includeActive: set.has("active"),
        includeWarning: set.has("warning"),
        includeExpired: set.has("expired"),
        includeLifetime: set.has("lifetime"),
        includeDisabled: set.has("disabled"),
    };
}

/**
 * 序列化为 `mstat` 查询值：
 * - 默认全选 → `null`（调用方可省略参数）
 * - 全部未选 → `"none"`（与解析端 sentinel 对齐）
 * - 其他子集 → 逗号列表
 */
export function serializeMstatParam(f: MembershipStatusFilter): string | null {
    if (isDefaultMembershipStatusFilter(f)) return null;
    if (isEmptyMembershipStatusFilter(f)) return NONE_SENTINEL;
    const out: string[] = [];
    if (f.includeActive) out.push("active");
    if (f.includeWarning) out.push("warning");
    if (f.includeExpired) out.push("expired");
    if (f.includeLifetime) out.push("lifetime");
    if (f.includeDisabled) out.push("disabled");
    return out.join(",");
}

/**
 * 名录页是否展示「会员状态」复选框：仅在「全部客户类型 / 仅会员」视图中提供。
 * 锁定为机构目录等场景不显示。
 */
export function showMembershipStatusFilterInDirectory(options: {
    lockClientType: boolean;
    clientType: string;
}): boolean {
    const { lockClientType, clientType } = options;
    if (lockClientType) {
        return clientType === "Member";
    }
    return clientType === "" || clientType === "Member";
}
