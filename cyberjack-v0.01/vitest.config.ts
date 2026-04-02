import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    minThreads: 1,
    maxThreads: 1,
  },
});
