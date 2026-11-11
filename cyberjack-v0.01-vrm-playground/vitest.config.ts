import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup-tests.ts'],
    globals: false,
    isolate: true,
    environment: 'node'
  }
});
