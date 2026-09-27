import assert from "node:assert/strict";
import test from "node:test";

import { dbTestUtils } from "./server/db.ts";

test("SQL placeholder splitter ignores question marks in literals and comments", () => {
    const sqlText = `
        SELECT '?' AS literal,
               'can''t touch ? here' AS escaped_literal,
               "?" AS quoted_identifier,
               \`?\` AS backtick_identifier,
               ? AS bound_value
        -- ? in line comment
        FROM receipts
        WHERE remark LIKE ?
          /* ? in block comment */
          AND payment_type = ?
    `;

    assert.equal(dbTestUtils.splitSqlPlaceholders(sqlText).length - 1, 3);
});

test("SQL placeholder splitter preserves parameter order boundaries", () => {
    assert.deepEqual(dbTestUtils.splitSqlPlaceholders("a ? b ? c"), [
        "a ",
        " b ",
        " c",
    ]);
});
