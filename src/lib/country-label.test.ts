import assert from "node:assert/strict";
import test from "node:test";

import { localizedCountryLabel, orderCountryValues } from "./country-label.ts";

test("country labels use the requested webpage locale while preserving the stored value", () => {
    assert.equal(localizedCountryLabel("China", "en"), "China");
    assert.equal(localizedCountryLabel("China", "zh-cn"), "中国");
    assert.equal(localizedCountryLabel("Burkina Faso", "zh-cn"), "布基纳法索");
});

test("unknown historical values remain visible instead of disappearing", () => {
    assert.equal(localizedCountryLabel("A legacy country value", "zh-cn"), "A legacy country value");
});

test("featured countries and regions are placed before the remaining countries", () => {
    assert.deepEqual(
        orderCountryValues(["Afghanistan", "Canada", "Taiwan", "China", "Macau", "Hong Kong"]),
        ["China", "Hong Kong", "Macau", "Canada", "Afghanistan", "Taiwan"],
    );
});
