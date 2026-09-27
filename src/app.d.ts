import type { Locale } from "$lib/paraglide/runtime";

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			locale: Locale,
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				DB: D1Database;
				ASSETS: Fetcher;
			};
			context: {
				waitUntil(promise: Promise<any>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export { };
