import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.d.ts', 'src/**/*.test.{ts,tsx}', 'src/test/**'],
      // UI/forms siguen warn-only (AGENTS.md), pero las utilidades puras y los
      // repos que sí cubrimos llevan umbral por archivo (real: lo hace cumplir
      // el step de CI `pnpm --filter @brian/web test:coverage`).
      thresholds: {
        'src/lib/texto.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/lib/fechas.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/clientes/clientesRepo.ts': { statements: 80, branches: 80, lines: 80 },
      },
    },
  },
});
