import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    fileParallelism: false,
    coverage: {
      provider: 'v8'
    }
  },
});
