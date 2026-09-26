import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [['apps/**', 'jsdom']],
    // Needed for @testing-library/react's automatic afterEach(cleanup): it only
    // registers itself when it finds a global `afterEach`. Safe for the engine
    // and AI suites too, since every test file there already imports its
    // vitest helpers explicitly rather than relying on the globals.
    globals: true,
  },
})
