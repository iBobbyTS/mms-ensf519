import assert from "node:assert/strict";
import test from "node:test";

import {
    formatMmsTitle,
    getHomeSections,
    getLogicalBackRoute,
    getPageTitleKey,
    isFullWidthPage,
} from "./app-shell.ts";

test("getPageTitleKey resolves localized and dynamic routes", () => {
    assert.equal(getPageTitleKey("/home"), "homeTitle");
    assert.equal(getPageTitleKey("/members"), "memberDirectoryPageTitle");
    assert.equal(getPageTitleKey("/members/add"), "memberAddPageTitle");
    assert.equal(getPageTitleKey("/members/card-download"), "memberCardCsvTitle");
    assert.equal(getPageTitleKey("/members/SCSC0261"), "clientDetailTitle");
    assert.equal(getPageTitleKey("/members/SCSC0261/edit"), "editClient");
    assert.equal(
        getPageTitleKey("/interest-group/manage"),
        "groupManagementTitle",
    );
    assert.equal(
        getPageTitleKey("/interest-group/attendance"),
        "interestGroupCheckInTitle",
    );
    assert.equal(getPageTitleKey("/unknown/path"), "homeTitle");
});

test("formatMmsTitle appends the required browser title suffix", () => {
    assert.equal(formatMmsTitle("会员目录"), "会员目录 - MMS");
});

test("member directory returns to the home page", () => {
    assert.deepEqual(getLogicalBackRoute("/members"), {
        href: "/home",
        labelKey: "backToHome",
    });
});

test("member add page returns to its directory", () => {
    assert.deepEqual(getLogicalBackRoute("/members/add"), {
        href: "/members",
        labelKey: "backToMemberDirectory",
    });
});

test("member detail and edit routes preserve logical navigation", () => {
    assert.deepEqual(getLogicalBackRoute("/members/SCSC0261"), {
        href: "/members",
        labelKey: "backToMemberDirectory",
    });
    assert.deepEqual(getLogicalBackRoute("/members/SCSC0261/edit"), {
        href: "/members/SCSC0261",
        labelKey: "backToMemberDetail",
    });
});

test("interest group pages return to the home page", () => {
    assert.deepEqual(getLogicalBackRoute("/interest-group/manage"), {
        href: "/home",
        labelKey: "backToHome",
    });
    assert.deepEqual(getLogicalBackRoute("/interest-group/attendance"), {
        href: "/home",
        labelKey: "backToHome",
    });
});

test("no page uses the full app width in this extract", () => {
    assert.equal(isFullWidthPage("/members"), false);
    assert.equal(isFullWidthPage("/interest-group/attendance"), false);
});

test("getHomeSections exposes the member and interest group modules", () => {
    const sections = getHomeSections();

    assert.deepEqual(sections.map((section) => section.id), ["members", "groups"]);
    assert.deepEqual(
        sections.find((section) => section.id === "members")?.buttons.map((button) => button.id),
        ["member-directory", "member-add"],
    );
    assert.deepEqual(
        sections.find((section) => section.id === "groups")?.buttons.map((button) => button.id),
        ["group-manage", "attendance"],
    );
    assert.equal(
        sections.find((section) => section.id === "members")?.buttons[0]?.href,
        "/members",
    );
    assert.equal(
        sections.find((section) => section.id === "groups")?.buttons[1]?.href,
        "/interest-group/attendance",
    );
});
