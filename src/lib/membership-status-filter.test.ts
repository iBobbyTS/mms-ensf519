import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    DEFAULT_MEMBERSHIP_STATUS_FILTER,
    isDefaultMembershipStatusFilter,
    isEmptyMembershipStatusFilter,
    membershipStatusFilterValues,
    membershipStatusFromFilterValue,
    parseMstatParam,
    sameMembershipStatusFilter,
    serializeMstatParam,
    showMembershipStatusFilterInDirectory,
} from "./membership-status-filter.ts";

describe("parseMstatParam / serializeMstatParam", () => {
    it("defaults when param missing or empty", () => {
        assert.deepEqual(parseMstatParam(null), DEFAULT_MEMBERSHIP_STATUS_FILTER);
        assert.deepEqual(parseMstatParam(""), DEFAULT_MEMBERSHIP_STATUS_FILTER);
    });
    it("parses subset and round-trips", () => {
        const f = parseMstatParam("active,warning");
        assert.equal(f.includeActive, true);
        assert.equal(f.includeWarning, true);
        assert.equal(f.includeExpired, false);
        assert.equal(f.includeLifetime, false);
        assert.equal(f.includeDisabled, false);
        assert.equal(serializeMstatParam(f), "active,warning");
    });
    it("ignores invalid tokens and falls back when nothing left", () => {
        assert.deepEqual(parseMstatParam("foo,bar"), DEFAULT_MEMBERSHIP_STATUS_FILTER);
    });
    it("is default for full set", () => {
        const f = parseMstatParam("active,warning,expired,lifetime");
        assert.ok(isDefaultMembershipStatusFilter(f));
        assert.equal(serializeMstatParam(f), null);
    });
    it("supports explicit empty set via 'none'", () => {
        const f = parseMstatParam("none");
        assert.ok(isEmptyMembershipStatusFilter(f));
        assert.equal(f.includeActive, false);
        assert.equal(f.includeWarning, false);
        assert.equal(f.includeExpired, false);
        assert.equal(f.includeLifetime, false);
        assert.equal(serializeMstatParam(f), "none");
    });
});

describe("membership status checkbox values", () => {
    it("converts filter state to checkbox values", () => {
        assert.deepEqual(membershipStatusFilterValues(DEFAULT_MEMBERSHIP_STATUS_FILTER), [
            "active",
            "warning",
            "expired",
            "lifetime",
        ]);
        assert.deepEqual(membershipStatusFilterValues(parseMstatParam("active,lifetime")), [
            "active",
            "lifetime",
        ]);
        assert.deepEqual(membershipStatusFilterValues(parseMstatParam("disabled")), ["disabled"]);
    });

    it("converts checkbox values to filter state", () => {
        assert.deepEqual(membershipStatusFromFilterValue(["warning", "expired", "ignored"]), {
            includeActive: false,
            includeWarning: true,
            includeExpired: true,
            includeLifetime: false,
            includeDisabled: false,
        });
        assert.ok(isEmptyMembershipStatusFilter(membershipStatusFromFilterValue(null)));
    });

    it("compares filter states by value", () => {
        assert.equal(
            sameMembershipStatusFilter(
                parseMstatParam("active,warning"),
                parseMstatParam("warning,active"),
            ),
            true,
        );
        assert.equal(
            sameMembershipStatusFilter(
                parseMstatParam("active,warning"),
                parseMstatParam("active,lifetime"),
            ),
            false,
        );
    });
});

describe("showMembershipStatusFilterInDirectory", () => {
    it("hides locked org directory", () => {
        assert.equal(
            showMembershipStatusFilterInDirectory({
                lockClientType: true,
                clientType: "Organization",
            }),
            false,
        );
    });
    it("shows locked member directory if used", () => {
        assert.equal(
            showMembershipStatusFilterInDirectory({ lockClientType: true, clientType: "Member" }),
            true,
        );
    });
    it("shows dashboard all types and member-only", () => {
        assert.equal(
            showMembershipStatusFilterInDirectory({ lockClientType: false, clientType: "" }),
            true,
        );
        assert.equal(
            showMembershipStatusFilterInDirectory({ lockClientType: false, clientType: "Member" }),
            true,
        );
    });
    it("hides when filtered to organization", () => {
        assert.equal(
            showMembershipStatusFilterInDirectory({
                lockClientType: false,
                clientType: "Organization",
            }),
            false,
        );
    });
});
