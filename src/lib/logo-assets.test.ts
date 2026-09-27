import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function pngSize(path: string): { width: number; height: number } {
    const buffer = readFileSync(path);
    assert.equal(buffer.toString("hex", 0, 8), "89504e470d0a1a0a", `${path} should be a PNG`);
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
    };
}

function icoImageCount(path: string): number {
    const buffer = readFileSync(path);
    assert.equal(buffer.readUInt16LE(0), 0, `${path} should have an ICO reserved field`);
    assert.equal(buffer.readUInt16LE(2), 1, `${path} should be an ICO image file`);
    return buffer.readUInt16LE(4);
}

test("app HTML declares browser, iOS, Android and Windows icons", () => {
    const appHtml = readFileSync("src/app.html", "utf8");

    assert.match(appHtml, /<link rel="icon" href="\/favicon\.ico" sizes="any" \/>/);
    assert.match(appHtml, /<link rel="icon" href="\/favicon-32x32\.png" type="image\/png" sizes="32x32" \/>/);
    assert.match(appHtml, /<link rel="icon" href="\/favicon-16x16\.png" type="image\/png" sizes="16x16" \/>/);
    assert.match(appHtml, /<link rel="icon" href="\/favicon-48x48\.png" type="image\/png" sizes="48x48" \/>/);
    assert.match(appHtml, /<link rel="icon" href="\/favicon-96x96\.png" type="image\/png" sizes="96x96" \/>/);
    assert.match(appHtml, /<link rel="apple-touch-icon" href="\/apple-touch-icon-120x120\.png" sizes="120x120" \/>/);
    assert.match(appHtml, /<link rel="apple-touch-icon" href="\/apple-touch-icon-152x152\.png" sizes="152x152" \/>/);
    assert.match(appHtml, /<link rel="apple-touch-icon" href="\/apple-touch-icon-167x167\.png" sizes="167x167" \/>/);
    assert.match(appHtml, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" sizes="180x180" \/>/);
    assert.match(appHtml, /<link rel="manifest" href="\/site\.webmanifest" \/>/);
    assert.match(appHtml, /<meta name="msapplication-TileImage" content="\/mstile-150x150\.png" \/>/);
    assert.match(appHtml, /<meta name="msapplication-config" content="\/browserconfig\.xml" \/>/);
    assert.doesNotMatch(appHtml, /favicon\.svg/);
});

test("generated static icons have expected dimensions", () => {
    const expectedPngSizes = new Map([
        ["static/logo.png", 1024],
        ["static/favicon-16x16.png", 16],
        ["static/favicon-32x32.png", 32],
        ["static/favicon-48x48.png", 48],
        ["static/favicon-96x96.png", 96],
        ["static/apple-touch-icon.png", 180],
        ["static/apple-touch-icon-precomposed.png", 180],
        ["static/apple-touch-icon-120x120.png", 120],
        ["static/apple-touch-icon-120x120-precomposed.png", 120],
        ["static/apple-touch-icon-152x152.png", 152],
        ["static/apple-touch-icon-152x152-precomposed.png", 152],
        ["static/apple-touch-icon-167x167.png", 167],
        ["static/apple-touch-icon-167x167-precomposed.png", 167],
        ["static/apple-touch-icon-180x180.png", 180],
        ["static/apple-touch-icon-180x180-precomposed.png", 180],
        ["static/android-chrome-192x192.png", 192],
        ["static/android-chrome-512x512.png", 512],
        ["static/maskable-icon-192x192.png", 192],
        ["static/maskable-icon-512x512.png", 512],
        ["static/mstile-150x150.png", 150],
        ["static/images/scsc-logo-receipt.png", 296],
    ]);

    assert.equal(existsSync("static/favicon.ico"), true);
    assert.equal(icoImageCount("static/favicon.ico"), 3);
    assert.equal(existsSync("static/browserconfig.xml"), true);

    for (const [path, size] of expectedPngSizes) {
        assert.equal(existsSync(path), true, `${path} should exist`);
        assert.deepEqual(pngSize(path), { width: size, height: size });
    }
});

test("web manifest declares installable app icons", () => {
    const manifest = JSON.parse(readFileSync("static/site.webmanifest", "utf8"));

    assert.equal(manifest.name, "SCSC Membership Management");
    assert.equal(manifest.short_name, "SCSC MMS");
    assert.deepEqual(
        manifest.icons.map((icon: { src: string; sizes: string; type: string; purpose?: string }) => [
            icon.src,
            icon.sizes,
            icon.type,
            icon.purpose ?? "any",
        ]),
        [
            ["/android-chrome-192x192.png", "192x192", "image/png", "any"],
            ["/android-chrome-512x512.png", "512x512", "image/png", "any"],
            ["/maskable-icon-192x192.png", "192x192", "image/png", "maskable"],
            ["/maskable-icon-512x512.png", "512x512", "image/png", "maskable"],
        ],
    );
});
