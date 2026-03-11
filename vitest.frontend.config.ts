import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest configuration for frontend/React component tests
 * Uses happy-dom for DOM simulation
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared/index.ts'),
      '@db': path.resolve(__dirname, 'src/db/index.ts'),
      '@': path.resolve(__dirname, 'src/renderer'),
    },
  },
  test: {
    name: 'frontend',
    environment: 'happy-dom',
    include: ['tests/frontend/**/*.test.tsx'],
    globals: true,
    setupFiles: ['tests/support/frontend-setup.ts'],
    deps: {
      interopDefault: true,
    },
    // Isolate tests to prevent state leakage between component tests
    isolate: true,
  },
});
