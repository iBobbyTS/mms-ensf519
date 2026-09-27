import assert from "node:assert/strict";
import test from "node:test";

import {
    normalizeThemePreference,
    resolveTheme,
} from "./preferences.ts";

test("normalizeThemePreference falls back to system for invalid values", () => {
    assert.equal(normalizeThemePreference("sepia"), "system");
    assert.equal(normalizeThemePreference(null), "system");
    assert.equal(normalizeThemePreference(undefined), "system");
});

test("normalizeThemePreference keeps supported values", () => {
    assert.equal(normalizeThemePreference("system"), "system");
    assert.equal(normalizeThemePreference("light"), "light");
    assert.equal(normalizeThemePreference("dark"), "dark");
});

test("resolveTheme follows system preference only in system mode", () => {
    assert.equal(resolveTheme("system", true), "dark");
    assert.equal(resolveTheme("system", false), "light");
    assert.equal(resolveTheme("light", true), "light");
    assert.equal(resolveTheme("dark", false), "dark");
});
