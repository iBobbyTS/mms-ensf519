import assert from "node:assert/strict";
import test from "node:test";

import {
    clampDropdownSearchLimit,
    getDropdownSearchClientCode,
    getDropdownSearchDisplayName,
    getDropdownSearchLabel,
    getDropdownSearchLegalName,
    type DropdownSearchItem,
} from "./dropdown-search.ts";

const sampleMember: DropdownSearchItem = {
    id: 1,
    value: "SCSC0001",
    clientCode: "SCSC0001",
    title: "张三 / Zhang San (SCSC0001)",
    label: "张三 / Zhang San (SCSC0001)",
    chineseName: "张三",
    englishName: "Zhang San",
    legalName: "Zhang San",
};

test("clampDropdownSearchLimit enforces supported range", () => {
    assert.equal(clampDropdownSearchLimit(-3), 1);
    assert.equal(clampDropdownSearchLimit(0), 1);
    assert.equal(clampDropdownSearchLimit(8.7), 8);
    assert.equal(clampDropdownSearchLimit(100), 50);
});

test("member dropdown helpers read SCSC-specific item fields", () => {
    assert.equal(getDropdownSearchClientCode(sampleMember), "SCSC0001");
    assert.equal(getDropdownSearchLabel(sampleMember), sampleMember.label);
    assert.equal(getDropdownSearchDisplayName(sampleMember), "张三");
    assert.equal(getDropdownSearchLegalName(sampleMember), "Zhang San");
    assert.equal(
        getDropdownSearchDisplayName({
            ...sampleMember,
            chineseName: "",
            englishName: "Zhang San",
        }),
        "Zhang San",
    );
});
