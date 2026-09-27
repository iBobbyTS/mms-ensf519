import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { detectLocale, normalizeLocale } from "./locale.ts";
import { localeCookieOptions, shouldRefreshLocaleCookie } from "./locale-cookie.ts";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const runtimeSourceRoots = ["src"];
const ignoredSourcePatterns = [
    /^src\/lib\/paraglide\//,
    /\.test\.[cm]?[jt]s$/,
];

function listRuntimeSourceFiles(root: string): string[] {
    const absoluteRoot = path.join(repoRoot, root);
    const results: string[] = [];
    for (const entry of readdirSync(absoluteRoot)) {
        const absolutePath = path.join(absoluteRoot, entry);
        const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, "/");
        const info = statSync(absolutePath);
        if (info.isDirectory()) {
            results.push(...listRuntimeSourceFiles(relativePath));
        } else if (info.isFile()) {
            results.push(relativePath);
        }
    }
    return results;
}

function isRuntimeSourceFile(filePath: string): boolean {
    return (
        /\.(?:svelte|ts|js)$/.test(filePath) &&
        !ignoredSourcePatterns.some((pattern) => pattern.test(filePath))
    );
}

test("normalizeLocale accepts exact and language-only locale values", () => {
    assert.equal(normalizeLocale("zh-cn"), "zh-cn");
    assert.equal(normalizeLocale("ZH-TW"), "zh-tw");
    assert.equal(normalizeLocale("en-US"), "en");
    assert.equal(normalizeLocale("zh-HK"), "zh-cn");
    assert.equal(normalizeLocale("fr-CA"), null);
});

test("detectLocale prefers cookie, then accept-language, then base locale", () => {
    assert.equal(
        detectLocale({
            cookieLocale: "zh-tw",
            acceptLanguage: "en-CA,en;q=0.8",
        }),
        "zh-tw",
    );
    assert.equal(
        detectLocale({
            acceptLanguage: "zh-TW,zh;q=0.9,en;q=0.8",
        }),
        "zh-tw",
    );
    assert.equal(
        detectLocale({
            acceptLanguage: "fr-CA,fr;q=0.9",
        }),
        "en",
    );
});

test("locale cookie remains readable to the browser language switcher", () => {
    assert.equal(localeCookieOptions.path, "/");
    assert.equal(localeCookieOptions.sameSite, "lax");
    assert.equal(localeCookieOptions.httpOnly, false);
    assert.ok(localeCookieOptions.maxAge > 0);
});

test("locale cookie refresh skips immutable/static assets only", () => {
    assert.equal(shouldRefreshLocaleCookie("/home"), true);
    assert.equal(shouldRefreshLocaleCookie("/api/members/search"), true);
    assert.equal(shouldRefreshLocaleCookie("/_app/immutable/entry/app.js"), false);
    assert.equal(shouldRefreshLocaleCookie("/images/scsc-logo-receipt.png"), false);
    assert.equal(shouldRefreshLocaleCookie("/favicon.ico"), false);
    assert.equal(shouldRefreshLocaleCookie("/apple-touch-icon.png"), false);
    assert.equal(shouldRefreshLocaleCookie("/android-chrome-192x192.png"), false);
    assert.equal(shouldRefreshLocaleCookie("/site.webmanifest"), false);
    assert.equal(shouldRefreshLocaleCookie("/browserconfig.xml"), false);
    assert.equal(shouldRefreshLocaleCookie("/robots.txt"), false);
});

test("runtime navigation does not use URL-localizing route helpers", () => {
    const forbiddenPatterns = [
        /\blocalizeHref\b/,
        /\bresolveRoute\b/,
        /\bbuildLocalizedHref\b/,
        /\bLocalizedRoutingAdapter\b/,
        /\bgetCanonicalPath\b/,
    ];
    const offenders = runtimeSourceRoots
        .flatMap(listRuntimeSourceFiles)
        .filter(isRuntimeSourceFile)
        .filter((filePath) => {
            const source = readFileSync(path.join(repoRoot, filePath), "utf8");
            return forbiddenPatterns.some((pattern) => pattern.test(source));
        });

    assert.deepEqual(offenders, []);
});
