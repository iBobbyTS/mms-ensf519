import assert from "node:assert/strict";
import test from "node:test";

import {
    maskDobDayOnly,
    maskEmailLocalSuffix,
    maskPhone,
} from "./sensitive-field.ts";

test("DOB masking reveals only the day", () => {
    assert.equal(maskDobDayOnly("1992-07-16"), "****-**-16");
    assert.equal(maskDobDayOnly("2000-01-01"), "****-**-01");
});

test("DOB masking fails closed for malformed values", () => {
    assert.equal(maskDobDayOnly("1992-7-16"), "****-**-**");
    assert.equal(maskDobDayOnly("not-a-date"), "****-**-**");
    assert.equal(maskDobDayOnly(""), "****-**-**");
});

test("phone masking reveals at most the last four digits", () => {
    assert.equal(maskPhone("403-555-1234"), "••••1234");
    assert.equal(maskPhone("1234"), "••••234");
    assert.equal(maskPhone("1"), "••••");
    assert.equal(maskPhone("extension only"), "••••");
    assert.equal(maskPhone(""), null);
});

test("email masking reveals the required local-part suffix and keeps the domain", () => {
    assert.equal(maskEmailLocalSuffix("abcdefgh@example.com"), "••••efgh@example.com");
    assert.equal(maskEmailLocalSuffix("abcdef@example.com"), "••••def@example.com");
    assert.equal(maskEmailLocalSuffix("abcde@example.com"), "••••de@example.com");
    assert.equal(maskEmailLocalSuffix("a@example.com"), "••••@example.com");
    assert.equal(maskEmailLocalSuffix("invalid"), "••••");
    assert.equal(maskEmailLocalSuffix(""), null);
});
