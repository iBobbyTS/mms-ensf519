import { strict as assert } from "node:assert";
import { test } from "node:test";

import { toSvelteUiLanguage } from "./svelte-ui-language.ts";

test("toSvelteUiLanguage maps Paraglide locales to svelte-ui-utils languages", () => {
    assert.equal(toSvelteUiLanguage("en"), "en_us");
    assert.equal(toSvelteUiLanguage("zh-cn"), "zh_cn");
    assert.equal(toSvelteUiLanguage("zh-tw"), "zh_tw");
    assert.equal(toSvelteUiLanguage(undefined), "en_us");
});
