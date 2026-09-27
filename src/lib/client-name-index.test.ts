import assert from "node:assert/strict";
import test from "node:test";

import {
    buildChineseNameSearchIndex,
    buildChineseNameSearchQuery,
    MAX_D1_LIKE_PATTERN_BYTES,
    MAX_PINYIN_COMBINATIONS,
} from "./server/client-name-index.ts";

function assertPinyinFields(
    name: string,
    expected: {
        pinyin: string | null;
        pinyinCompact: string | null;
        pinyinInitials: string | null;
        pinyinGivenSurname: string | null;
    },
) {
    const index = buildChineseNameSearchIndex(name);
    assert.deepEqual(
        {
            pinyin: index.pinyin,
            pinyinCompact: index.pinyinCompact,
            pinyinInitials: index.pinyinInitials,
            pinyinGivenSurname: index.pinyinGivenSurname,
        },
        expected,
    );
    return index;
}

function searchTerms(name: string): string[] {
    return (buildChineseNameSearchIndex(name).searchTerms ?? "")
        .split("\n")
        .filter(Boolean);
}

test("buildChineseNameSearchIndex stores simplified Chinese pinyin keys", () => {
    const index = assertPinyinFields("张三", {
        pinyin: "zhang san",
        pinyinCompact: "zhangsan",
        pinyinInitials: "zs",
        pinyinGivenSurname: "san zhang",
    });
    assert.ok(index.searchTerms?.includes("\n张三\n"));
    assert.ok(index.searchTerms?.includes("\nzhangsan\n"));
});

test("buildChineseNameSearchIndex stores traditional Chinese pinyin keys", () => {
    const index = assertPinyinFields("張三", {
        pinyin: "zhang san",
        pinyinCompact: "zhangsan",
        pinyinInitials: "zs",
        pinyinGivenSurname: "san zhang",
    });
    assert.ok(index.searchTerms?.includes("\n張三\n"));
    assert.ok(index.searchTerms?.includes("\n张三\n"));
});

test("buildChineseNameSearchIndex ignores non-Chinese separators", () => {
    assertPinyinFields("王 小明-A", {
        pinyin: "wang xiao ming",
        pinyinCompact: "wangxiaoming",
        pinyinInitials: "wxm",
        pinyinGivenSurname: "xiaoming wang",
    });
});

test("buildChineseNameSearchIndex normalizes umlaut pinyin to v", () => {
    assertPinyinFields("吕布", {
        pinyin: "lv bu",
        pinyinCompact: "lvbu",
        pinyinInitials: "lb",
        pinyinGivenSurname: "bu lv",
    });
});

test("buildChineseNameSearchIndex stores given-name-first pinyin key", () => {
    assertPinyinFields("孙悦成", {
        pinyin: "sun yue cheng",
        pinyinCompact: "sunyuecheng",
        pinyinInitials: "syc",
        pinyinGivenSurname: "yuecheng sun",
    });
    assert.deepEqual(
        [
            "孙悦成",
            "sunyuecheng",
            "sun yue cheng",
            "sun yuecheng",
            "yuecheng sun",
            "syc",
        ].every((term) => searchTerms("孙悦成").includes(term)),
        true,
    );
    assert.deepEqual(
        [
            "孫悅成",
            "孙悦成",
            "sunyuecheng",
            "sun yue cheng",
            "sun yuecheng",
            "yuecheng sun",
            "syc",
        ].every((term) => searchTerms("孫悅成").includes(term)),
        true,
    );
});

test("buildChineseNameSearchIndex does not create given-name-first key for single-character names", () => {
    assertPinyinFields("孙", {
        pinyin: "sun",
        pinyinCompact: "sun",
        pinyinInitials: "s",
        pinyinGivenSurname: null,
    });
});

test("buildChineseNameSearchIndex returns null keys for empty names", () => {
    assert.deepEqual(buildChineseNameSearchIndex("  "), {
        pinyin: null,
        pinyinCompact: null,
        pinyinInitials: null,
        pinyinGivenSurname: null,
        searchTerms: null,
    });
});

test("buildChineseNameSearchQuery adds compact and simplified variants", () => {
    assert.deepEqual(buildChineseNameSearchQuery("sun yuecheng").variants, [
        "sun yuecheng",
        "sunyuecheng",
    ]);
    assert.deepEqual(buildChineseNameSearchQuery("孫悅成").variants, [
        "孫悅成",
        "孙悦成",
    ]);

    const simplifiedStoredTerms = searchTerms("孙悦成");
    const traditionalQuery = buildChineseNameSearchQuery("孫悅成");
    assert.ok(traditionalQuery.variants.some((variant) => simplifiedStoredTerms.includes(variant)));
});

test("buildChineseNameSearchQuery keeps LIKE patterns within the D1 UTF-8 byte limit", () => {
    assert.equal(MAX_D1_LIKE_PATTERN_BYTES, 50);

    const regularBoundary = buildChineseNameSearchQuery("a".repeat(48));
    assert.deepEqual(regularBoundary.likePatterns, [`%${"a".repeat(48)}%`]);
    assert.deepEqual(regularBoundary.exactTermPatterns, [null]);

    const exactTermBoundary = buildChineseNameSearchQuery("a".repeat(46));
    assert.deepEqual(exactTermBoundary.exactTermPatterns, [
        `%\n${"a".repeat(46)}\n%`,
    ]);

    const multibyteOverLimit = buildChineseNameSearchQuery("数".repeat(17));
    assert.deepEqual(multibyteOverLimit.likePatterns, []);
    assert.deepEqual(multibyteOverLimit.exactTermPatterns, [null]);
});

test("buildChineseNameSearchQuery rejects overlong path patterns without truncating variants", () => {
    const path = "/Users/ibobby/SCSC/FSII/数据校对/output/20260726-131052/data.jsonl";
    const query = buildChineseNameSearchQuery(path);

    assert.deepEqual(query.variants, [
        path.toLowerCase(),
        "usersibobbyscscfsii数据校对output20260726131052datajsonl",
    ]);
    assert.deepEqual(query.likePatterns, []);
    assert.deepEqual(query.exactTermPatterns, [null, null]);
});

test("buildChineseNameSearchIndex stores pinyin-pro polyphonic combinations under the cap", () => {
    const terms = searchTerms("重庆");
    assert.ok(terms.includes("chongqing"));
    assert.ok(terms.includes("zhongqing"));
    assert.ok(terms.includes("chong qing"));
    assert.ok(terms.includes("zhong qing"));
});

test("buildChineseNameSearchIndex does not expand polyphonic combinations over the cap", () => {
    const terms = searchTerms("长乐行重长");
    assert.equal(MAX_PINYIN_COMBINATIONS, 64);
    assert.ok(terms.includes("changlexingzhongchang"));
    assert.ok(terms.includes("zhang"));
    assert.ok(terms.includes("yue"));
    assert.ok(terms.includes("hang"));
    assert.ok(terms.includes("chong"));
    assert.equal(terms.includes("zhangyuehangchongzhang"), false);
});
