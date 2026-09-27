import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  build: {
    target: 'chrome79'
  },
  optimizeDeps: {
    exclude: ['@ibobbyts/svelte-ui-utils', '@ibobbyts/svelte-ui-utils/dropdown', '@ibobbyts/svelte-ui-utils/dropdown-search', '@ibobbyts/svelte-ui-utils/dropdown-search/state', '@ibobbyts/svelte-ui-utils/pagination', '@ibobbyts/svelte-ui-utils/table', '@ibobbyts/svelte-ui-utils/toast']
  },
  server: {
    host: true,
    port: 8787,
    strictPort: true
  },
  preview: {
    host: true,
    port: 8787,
    strictPort: true
  }
});
