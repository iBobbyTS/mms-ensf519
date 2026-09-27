import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { shouldDisableRemoteBrowserRun } from './src/lib/browser-run-development.js';

const disableRemoteBrowserRun = shouldDisableRemoteBrowserRun(process.env);

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment isn't supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		// NOTE: FSII upload log requests are capped at 2 MiB inside the view page's
		// applyLog action (FSII_UPLOAD_LOG_MAX_BYTES); the installed SvelteKit has
		// removed kit.bodySizeLimit, so no framework-level body limit applies here.
		adapter: adapter({
			platformProxy: {
				remoteBindings: !disableRemoteBrowserRun
			}
		})
	}
};

export default config;
