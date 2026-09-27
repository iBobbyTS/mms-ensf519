import assert from "node:assert/strict";
import test from "node:test";

import {
    coerceGenderForMigration,
    GENDER_VALUES,
    MEMBER_GENDER_VALUES,
    normalizeMemberGenderForStorage,
    normalizeMemberGenderValue,
    projectMemberGenderForStorage,
    restoreMemberGender,
    normalizeGenderForStorage,
    normalizeGenderValue,
} from "./gender.ts";

test("gender values are limited to male, female, and other", () => {
    assert.deepEqual(GENDER_VALUES, ["Male", "Female", "Other"]);
});

test("member gender values include FSII choices without changing child values", () => {
    assert.deepEqual(GENDER_VALUES, ["Male", "Female", "Other"]);
    assert.deepEqual(MEMBER_GENDER_VALUES, [
        "Male",
        "Female",
        "Transgender",
        "Prefer not to disclose",
        "Other",
    ]);
    assert.equal(normalizeMemberGenderValue("Transgender"), "Transgender");
    assert.equal(normalizeMemberGenderValue(" transgender "), "Transgender");
    assert.equal(
        normalizeMemberGenderValue("Prefer not to disclose"),
        "Prefer not to disclose",
    );
    assert.equal(
        normalizeMemberGenderValue("Prefer Not Disclose"),
        "Prefer not to disclose",
    );
    assert.equal(normalizeMemberGenderForStorage("Transgender"), "Transgender");
    assert.deepEqual(projectMemberGenderForStorage("Transgender"), {
        gender: "Other",
        fsiiGenderDetail: "Transgender",
    });
    assert.deepEqual(projectMemberGenderForStorage("Female"), {
        gender: "Female",
        fsiiGenderDetail: null,
    });
    assert.equal(restoreMemberGender("Other", "Prefer not to disclose"), "Prefer not to disclose");
    assert.equal(restoreMemberGender("Other", null), "Other");
    assert.throws(() => normalizeMemberGenderForStorage("unknown"), /invalid_member_gender/);
});

test("gender normalization maps legacy values to other", () => {
    assert.equal(normalizeGenderValue("Male"), "Male");
    assert.equal(normalizeGenderValue("Female"), "Female");
    assert.equal(normalizeGenderValue("Other"), "Other");
    assert.equal(normalizeGenderValue(" male "), "Male");
    assert.equal(normalizeGenderValue(" FEMALE "), "Female");
    assert.equal(normalizeGenderValue("Transgender"), "Other");
    assert.equal(normalizeGenderValue("Prefer Not Disclose"), "Other");
    assert.equal(normalizeGenderValue("其他"), "Other");
});

test("gender storage rejects unknown non-empty values", () => {
    assert.equal(normalizeGenderForStorage(""), null);
    assert.equal(normalizeGenderForStorage("Other"), "Other");
    assert.throws(() => normalizeGenderForStorage("unknown"), /invalid_gender/);
});

test("migration gender coercion preserves data by folding unknown values to other", () => {
    assert.equal(coerceGenderForMigration(""), null);
    assert.equal(coerceGenderForMigration("Female"), "Female");
    assert.equal(coerceGenderForMigration(" male "), "Male");
    assert.equal(coerceGenderForMigration("Transgender"), "Other");
    assert.equal(coerceGenderForMigration("unexpected legacy value"), "Other");
});
