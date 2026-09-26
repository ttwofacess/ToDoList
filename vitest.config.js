import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Solo tests unitarios en jsdom. Los de integración corren vía Playwright.
    include: ['tests/unit/**/*.test.js'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/helpers/setup.js'],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    reporters: ['verbose'],
  },
});
