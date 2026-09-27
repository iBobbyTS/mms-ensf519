import assert from "node:assert/strict";
import test from "node:test";

import {
    DISABLE_REMOTE_BROWSER_RUN_ENV,
    shouldDisableRemoteBrowserRun,
} from "./browser-run-development.js";

test("remote Browser Run stays enabled unless the disable switch is exactly one", () => {
    assert.equal(shouldDisableRemoteBrowserRun({}), false);
    assert.equal(shouldDisableRemoteBrowserRun({ [DISABLE_REMOTE_BROWSER_RUN_ENV]: "" }), false);
    assert.equal(shouldDisableRemoteBrowserRun({ [DISABLE_REMOTE_BROWSER_RUN_ENV]: "0" }), false);
    assert.equal(shouldDisableRemoteBrowserRun({ [DISABLE_REMOTE_BROWSER_RUN_ENV]: "true" }), false);
    assert.equal(shouldDisableRemoteBrowserRun({ [DISABLE_REMOTE_BROWSER_RUN_ENV]: "1" }), true);
});
