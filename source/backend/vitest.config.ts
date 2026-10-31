import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.spec.ts',
      'prisma/**/*.spec.ts',
      'scripts/**/*.spec.ts',
    ],
  },
});
