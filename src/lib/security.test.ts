import assert from "node:assert/strict";
import test from "node:test";

import { isSameOriginUnsafeRequest } from "./server/security.ts";

test("unsafe requests require Origin or Referer to match the current origin", () => {
    const url = new URL("https://mms.example.test/admin");

    assert.equal(isSameOriginUnsafeRequest("GET", url, new Headers()), true);
    assert.equal(
        isSameOriginUnsafeRequest(
            "POST",
            url,
            new Headers({ origin: "https://mms.example.test" }),
        ),
        true,
    );
    assert.equal(
        isSameOriginUnsafeRequest(
            "POST",
            url,
            new Headers({ referer: "https://mms.example.test/admin" }),
        ),
        true,
    );
    assert.equal(
        isSameOriginUnsafeRequest(
            "POST",
            url,
            new Headers({ origin: "https://evil.example.test" }),
        ),
        false,
    );
    assert.equal(isSameOriginUnsafeRequest("POST", url, new Headers()), false);
});
