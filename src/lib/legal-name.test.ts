import assert from "node:assert/strict";
import test from "node:test";

import {
    formatLegalNameFirstLast,
    formatLegalNameLastFirst,
} from "./server/legal-name.ts";

test("formatLegalNameFirstLast uses the default legal name order", () => {
    assert.equal(formatLegalNameFirstLast("Zhang", "San"), "Zhang San");
    assert.equal(formatLegalNameFirstLast(" Zhang ", " San "), "Zhang San");
});

test("formatLegalNameLastFirst uses explicit last-name-first order", () => {
    assert.equal(formatLegalNameLastFirst("Zhang", "San"), "San, Zhang");
    assert.equal(formatLegalNameLastFirst(" Zhang ", " San "), "San, Zhang");
});

test("legal name formatters tolerate missing name parts", () => {
    assert.equal(formatLegalNameFirstLast("Zhang", ""), "Zhang");
    assert.equal(formatLegalNameFirstLast("", "San"), "San");
    assert.equal(formatLegalNameFirstLast(" ", null), null);
    assert.equal(formatLegalNameLastFirst("Zhang", ""), "Zhang");
    assert.equal(formatLegalNameLastFirst("", "San"), "San");
    assert.equal(formatLegalNameLastFirst(null, " "), null);
});
