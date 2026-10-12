import type { UserConfig } from 'vitest/config';

/**
 * Fuente única de los umbrales de cobertura (PRD §6.3 / AGENTS.md). Cada paquete
 * de dominio extiende esta config vía `packageVitestConfig('<paquete>')` para que
 * el gate de CI y el shape de cobertura no se desincronicen.
 */
export interface CoverageThresholds {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export type CoveredPackage =
  'sync-engine' | 'scoring' | 'pin-auth' | 'clientes' | 'ventas' | 'shared';

export const COVERAGE_THRESHOLDS: Record<CoveredPackage, Partial<CoverageThresholds>> = {
  'sync-engine': { statements: 90, branches: 80, functions: 85, lines: 90 },
  scoring: { statements: 85, branches: 80, functions: 80, lines: 85 },
  'pin-auth': { statements: 85, branches: 80, functions: 80, lines: 85 },
  clientes: { statements: 80, branches: 75, functions: 75, lines: 80 },
  ventas: { statements: 80, branches: 75, functions: 75, lines: 80 },
  // shared es tipos/constantes/schemas: el conteo de "functions" de v8 lo mueven
  // los objetos zod y las constantes, no lógica; se gatea por líneas/ramas.
  shared: { statements: 95, branches: 90, lines: 95 },
};

/**
 * Config base de los paquetes de dominio: entorno node, tests en `tests/`,
 * cobertura v8 sobre `src/` con los mismos excludes. Los umbrales salen del
 * mapa central por nombre de paquete.
 */
export function packageVitestConfig(pkg: CoveredPackage): UserConfig {
  return {
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**/*.ts'],
        exclude: ['src/index.ts', 'src/ports.ts', 'src/types.ts', 'src/**/*.test.ts'],
        thresholds: COVERAGE_THRESHOLDS[pkg],
      },
    },
  };
}
