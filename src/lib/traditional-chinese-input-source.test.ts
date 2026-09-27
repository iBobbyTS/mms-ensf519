import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("TraditionalChineseInput implements debounced vertical and horizontal suggestion layouts", () => {
    const source = readFileSync("src/lib/components/TraditionalChineseInput.svelte", "utf8");

    assert.match(source, /type Layout = "horizontal" \| "vertical"/);
    assert.match(source, /const debounceMs = 200;/);
    assert.match(source, /setTimeout\(\(\) => \{/);
    assert.match(source, /layout === "horizontal"/);
    assert.match(source, /traditionalChineseNameInlineSuggestion/);
    assert.match(source, /traditionalChineseNameReplace/);
    assert.match(source, /replaceTraditionalChineseCharacters\(value\)/);
    assert.match(source, /role="status"/);
    assert.match(source, /aria-live="polite"/);
    assert.match(source, /aria-atomic="true"/);
});

test("member forms share vertical TraditionalChineseInput for Chinese names", () => {
    const basicInfoSource = readFileSync("src/lib/components/PersonBasicInfoSection.svelte", "utf8");
    const chineseNameBlock = basicInfoSource.slice(
        basicInfoSource.indexOf("<TraditionalChineseInput"),
        basicInfoSource.indexOf('<div class="grid gap-4 md:grid-cols-3">'),
    );

    assert.match(basicInfoSource, /import TraditionalChineseInput/);
    assert.match(chineseNameBlock, /name="chineseName"/);
    assert.match(chineseNameBlock, /bind:value=\{person\.chineseName\}/);
    assert.match(chineseNameBlock, /layout="vertical"/);
    assert.match(chineseNameBlock, /showRequiredIndicator/);

    for (const file of [
        "src/lib/components/ClientForm.svelte",
    ]) {
        const source = readFileSync(file, "utf8");
        assert.match(source, /import PersonBasicInfoSection/);
        assert.match(source, /<PersonBasicInfoSection/);
        assert.match(source, /traditionalChineseNameConfirmWarning/);
        assert.match(source, /traditionalChineseNameContinueSave/);
    }
});
