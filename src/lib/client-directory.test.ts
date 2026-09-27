import assert from "node:assert/strict";
import test from "node:test";

import {
    CLIENT_DIRECTORY_PAGE_SIZES,
    isClientDirectoryPageSize,
    resolveClientDirectoryPageSize,
    resolveClientDirectorySort,
} from "./client-directory.ts";

test("resolveClientDirectoryPageSize returns the canonical default", () => {
    assert.equal(resolveClientDirectoryPageSize(), 20);
});

test("isClientDirectoryPageSize matches the allowed set", () => {
    for (const n of CLIENT_DIRECTORY_PAGE_SIZES) {
        assert.equal(isClientDirectoryPageSize(n), true);
    }
    assert.equal(isClientDirectoryPageSize(15), false);
    assert.equal(isClientDirectoryPageSize(200), false);
});

test("resolveClientDirectorySort applies whitelist and default direction", () => {
    assert.deepEqual(
        resolveClientDirectorySort({ sort: "client_code", dir: "asc" }),
        { sort: "client_code", dir: "asc" },
    );
    assert.deepEqual(
        resolveClientDirectorySort({ sort: "unsafe_sql", dir: "sideways" }),
        { sort: null, dir: "desc" },
    );
});
