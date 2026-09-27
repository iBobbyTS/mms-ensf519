const STATIC_ASSET_PATHS = new Set([
    "/android-chrome-192x192.png",
    "/android-chrome-512x512.png",
    "/apple-touch-icon.png",
    "/apple-touch-icon-precomposed.png",
    "/apple-touch-icon-120x120.png",
    "/apple-touch-icon-120x120-precomposed.png",
    "/apple-touch-icon-152x152.png",
    "/apple-touch-icon-152x152-precomposed.png",
    "/apple-touch-icon-167x167.png",
    "/apple-touch-icon-167x167-precomposed.png",
    "/apple-touch-icon-180x180.png",
    "/apple-touch-icon-180x180-precomposed.png",
    "/browserconfig.xml",
    "/favicon.ico",
    "/favicon-16x16.png",
    "/favicon-32x32.png",
    "/favicon-48x48.png",
    "/favicon-96x96.png",
    "/logo.png",
    "/maskable-icon-192x192.png",
    "/maskable-icon-512x512.png",
    "/mstile-150x150.png",
    "/robots.txt",
    "/site.webmanifest",
]);

export function isStaticAssetPath(pathname: string): boolean {
    return pathname.startsWith("/_app/") || pathname.startsWith("/images/") || STATIC_ASSET_PATHS.has(pathname);
}
