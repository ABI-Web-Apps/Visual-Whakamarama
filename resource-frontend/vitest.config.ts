import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  define: {
    // The standalone build's values: the suite exercises the app, and the
    // plugin build differs only in routing (memory vs history) and CSS.
    __IS_PLUGIN__: 'false',
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    // The suites for the functions this app contributed back to copper3d
    // moved out with them: they live in that repo now and run against
    // copper3d's own harness. What is left here is this app's own code.
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    // The dev backend's address, pinned so a developer's own `.env` cannot
    // change what the suite's imaging and API URLs read.
    env: { VITE_PLUGIN_API_URL: 'http://localhost', VITE_PLUGIN_API_PORT: '8082' },
  },
})
