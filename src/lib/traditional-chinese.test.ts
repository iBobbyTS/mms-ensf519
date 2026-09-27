import assert from "node:assert/strict";
import test from "node:test";

import {
    findTraditionalChineseCharacters,
    replaceTraditionalChineseCharacters,
    traditionalChineseSuggestionText,
} from "./traditional-chinese.ts";

test("findTraditionalChineseCharacters suggests simplified characters for traditional names", () => {
    assert.deepEqual(findTraditionalChineseCharacters("張三"), [
        { character: "張", suggestion: "张" },
    ]);
    assert.equal(replaceTraditionalChineseCharacters("張三"), "张三");
});

test("findTraditionalChineseCharacters ignores shared simplified/traditional characters", () => {
    assert.deepEqual(findTraditionalChineseCharacters("中文"), []);
    assert.equal(traditionalChineseSuggestionText("中文"), null);
});

test("traditional Chinese suggestions are deduplicated while replacement covers all occurrences", () => {
    assert.deepEqual(findTraditionalChineseCharacters("張小張"), [
        { character: "張", suggestion: "张" },
    ]);
    assert.equal(replaceTraditionalChineseCharacters("張小張"), "张小张");
});

test("name replacement stays character-by-character instead of phrase conversion", () => {
    assert.deepEqual(traditionalChineseSuggestionText("乾隆"), {
        traditional: "乾",
        simplified: "干",
        suggestedValue: "干隆",
    });
    assert.equal(replaceTraditionalChineseCharacters("乾隆"), "干隆");
});

test("mixed names replace only converted characters and preserve other text", () => {
    assert.deepEqual(traditionalChineseSuggestionText("王麗Anna"), {
        traditional: "麗",
        simplified: "丽",
        suggestedValue: "王丽Anna",
    });
});
