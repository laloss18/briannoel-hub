import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.d.ts'],
      // Per AGENTS.md, UI coverage is a warn-only floor (50–60%); the blocking
      // gate lives in the sync-engine package. Thresholds ramp up with Fase 2
      // form coverage.
    },
  },
});
