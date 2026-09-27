/**
 * Unified membership state: based on the membership fee year vs. the current calendar year.
 * No reliance on legacy membership expiry dates or 365-day calculations.
 */
import { currentBusinessYear } from "./local-date.ts";

/**
 * Returns the current business calendar year as a number.
 */
export function currentYear(now = new Date()): number {
    return currentBusinessYear(now);
}

/**
 * Unified membership state for all contexts (directory, attendance check-in, etc.).
 *
 * State semantics:
 * - "info"    — not a Member (Organization and other non-member contexts)
 * - "valid"   — membership is active (Lifetime, or membership year >= current year)
 * - "grace"   — membership year = current year - 1 (pending renewal)
 * - "expired" — membership year < current year - 1, or never paid
 */
export function getMembershipState(input: {
    clientType: string;
    membershipType: string;
    lastMembershipYear: number | null;
    currentYear: number;
}): "info" | "valid" | "grace" | "expired" {
    if (input.clientType !== "Member") return "info";
    if (input.membershipType === "Lifetime") return "valid";
    if (input.lastMembershipYear === null) return "expired";
    if (input.lastMembershipYear > input.currentYear) return "valid";
    if (input.lastMembershipYear === input.currentYear) return "valid";
    if (input.lastMembershipYear === input.currentYear - 1) return "grace";
    return "expired";
}
