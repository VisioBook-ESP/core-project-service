import { defineWorkspace } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      include: ['test/unit/**/*.spec.ts'],
      environment: 'node',
      globals: true,
    },
  },
  {
    test: {
      name: 'integration',
      include: ['test/integration/**/*.integration.spec.ts'],
      environment: 'node',
      globals: true,
      pool: 'forks',
      testTimeout: 30000,
    },
  },
  {
    plugins: [swc.vite({ module: { type: 'es6' } })],
    test: {
      name: 'e2e',
      include: ['test/e2e/**/*.e2e.spec.ts'],
      environment: 'node',
      globals: true,
      pool: 'forks',
      testTimeout: 60000,
    },
  },
]);
