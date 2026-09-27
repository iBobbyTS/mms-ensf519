import assert from "node:assert/strict";
import test from "node:test";

import {
    consumePageFlash,
    PAGE_FLASH_COOKIE,
    setPageFlash,
} from "./server/page-flash.ts";

function createCookieJar(initial?: string) {
    let value = initial;
    const setCalls: Array<{ name: string; value: string; options: unknown }> = [];
    const deleteCalls: Array<{ name: string; options: unknown }> = [];
    return {
        cookies: {
            get(name: string) {
                return name === PAGE_FLASH_COOKIE ? value : undefined;
            },
            set(name: string, nextValue: string, options: unknown) {
                value = nextValue;
                setCalls.push({ name, value: nextValue, options });
            },
            delete(name: string, options: unknown) {
                value = undefined;
                deleteCalls.push({ name, options });
            },
        },
        setCalls,
        deleteCalls,
    };
}

test("page flash sets the fixed cookie contract for HTTP and HTTPS", () => {
    for (const secure of [false, true]) {
        const jar = createCookieJar();
        setPageFlash(jar.cookies, { path: "/projects", value: "created", secure });
        assert.deepEqual(jar.setCalls, [{
            name: PAGE_FLASH_COOKIE,
            value: "created",
            options: {
                path: "/projects",
                httpOnly: true,
                sameSite: "lax",
                secure,
                maxAge: 60,
            },
        }]);
    }
});

test("page flash consumes and deletes a present value exactly once", () => {
    const jar = createCookieJar("renamed");

    assert.equal(consumePageFlash(jar.cookies, "/projects"), "renamed");
    assert.equal(consumePageFlash(jar.cookies, "/projects"), null);
    assert.deepEqual(jar.deleteCalls, [
        { name: PAGE_FLASH_COOKIE, options: { path: "/projects" } },
    ]);
});

test("page flash deletes an unrecognized value so it cannot persist", () => {
    const jar = createCookieJar("not-a-valid-route-flash");

    assert.equal(consumePageFlash(jar.cookies, "/interest-group/manage"), "not-a-valid-route-flash");
    assert.deepEqual(jar.deleteCalls, [{
        name: PAGE_FLASH_COOKIE,
        options: { path: "/interest-group/manage" },
    }]);
});

test("page flash leaves the cookie jar untouched when the value is missing", () => {
    const jar = createCookieJar();

    assert.equal(consumePageFlash(jar.cookies, "/activities"), null);
    assert.deepEqual(jar.deleteCalls, []);
});
