import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    currentYear,
    getMembershipState,
} from "./membership-year-status.ts";

describe("currentYear", () => {
    it("returns the current business calendar year as a number", () => {
        const year = currentYear();
        assert.equal(typeof year, "number");
        assert.ok(year >= 2024);
        assert.equal(currentYear(new Date("2026-01-01T06:30:00.000Z")), 2025);
        assert.equal(currentYear(new Date("2026-01-01T07:00:00.000Z")), 2026);
    });
});

describe("getMembershipState", () => {
    it("classifies current, grace, and expired membership years", () => {
        const base = { clientType: "Member", membershipType: "General" as const, currentYear: 2026 };
        assert.equal(getMembershipState({ ...base, lastMembershipYear: 2026, membershipType: "General" }), "valid");
        assert.equal(getMembershipState({ ...base, lastMembershipYear: 2025, membershipType: "General" }), "grace");
        assert.equal(getMembershipState({ ...base, lastMembershipYear: 2024, membershipType: "General" }), "expired");
    });
    it("non-member always returns info", () => {
        assert.equal(
            getMembershipState({ clientType: "Organization", membershipType: "General", lastMembershipYear: null, currentYear: 2026 }),
            "info",
        );
    });
    it("Lifetime members always return valid regardless of membership year", () => {
        assert.equal(
            getMembershipState({ clientType: "Member", membershipType: "Lifetime", lastMembershipYear: null, currentYear: 2026 }),
            "valid",
        );
        assert.equal(
            getMembershipState({ clientType: "Member", membershipType: "Lifetime", lastMembershipYear: 2024, currentYear: 2026 }),
            "valid",
        );
    });
    it("null lastMembershipYear (never paid) returns expired", () => {
        assert.equal(
            getMembershipState({ clientType: "Member", membershipType: "General", lastMembershipYear: null, currentYear: 2026 }),
            "expired",
        );
    });
    it("two or more years behind returns expired", () => {
        assert.equal(
            getMembershipState({ clientType: "Member", membershipType: "General", lastMembershipYear: 2023, currentYear: 2026 }),
            "expired",
        );
        assert.equal(
            getMembershipState({ clientType: "Member", membershipType: "General", lastMembershipYear: 2010, currentYear: 2026 }),
            "expired",
        );
    });
    it("grace period is exactly currentYear - 1", () => {
        assert.equal(
            getMembershipState({ clientType: "Member", membershipType: "General", lastMembershipYear: 2025, currentYear: 2026 }),
            "grace",
        );
        assert.equal(
            getMembershipState({ clientType: "Member", membershipType: "General", lastMembershipYear: 2024, currentYear: 2025 }),
            "grace",
        );
    });
    it("current year or later is valid, future year is also valid (pre-paid)", () => {
        assert.equal(
            getMembershipState({ clientType: "Member", membershipType: "General", lastMembershipYear: 2026, currentYear: 2026 }),
            "valid",
        );
        assert.equal(
            getMembershipState({ clientType: "Member", membershipType: "General", lastMembershipYear: 2027, currentYear: 2026 }),
            "valid",
        );
    });
});
