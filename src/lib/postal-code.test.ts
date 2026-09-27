import assert from "node:assert/strict";
import test from "node:test";
import { isValidCanadianPostalCode, normalizeCanadianPostalCode } from "./postal-code.ts";
import { isValidEmail } from "./email.ts";

test("Canadian postal code validation accepts compact and spaced formats", () => {
    for (const value of ["T2L2M4", "T2L 2M4", "t2l 2m4", ""]) {
        assert.equal(isValidCanadianPostalCode(value), true);
    }
});

test("Canadian postal code validation rejects values outside the format", () => {
    for (const value of ["T2L2M4ss", "T2L-2M4", "123456", "T2L  2M4"]) {
        assert.equal(isValidCanadianPostalCode(value), false);
    }
});

test("Canadian postal codes are normalized to uppercase compact storage", () => {
    assert.equal(normalizeCanadianPostalCode("t2l 2m4"), "T2L2M4");
    assert.equal(normalizeCanadianPostalCode(" T2L2M4 "), "T2L2M4");
    assert.equal(normalizeCanadianPostalCode("T2L  2M4"), "T2L  2M4");
    assert.equal(normalizeCanadianPostalCode(""), "");
});

test("email validation rejects addresses without a domain suffix", () => {
    assert.equal(isValidEmail("ibobbyts@gmailcom"), false);
    assert.equal(isValidEmail("info@scsc.ca"), true);
    assert.equal(isValidEmail(""), true);
});
