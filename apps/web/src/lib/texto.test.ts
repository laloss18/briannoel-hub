import { describe, expect, it } from 'vitest';
import { normaliza } from './texto';

describe('normaliza', () => {
  it('pasa a minúsculas y elimina acentos', () => {
    expect(normaliza('José Ángel')).toBe('jose angel');
    expect(normaliza('MARÍA')).toBe('maria');
  });

  it('preserva dígitos, espacios y símbolos', () => {
    expect(normaliza('V-123.456')).toBe('v-123.456');
    expect(normaliza('  Juan  Pérez  ')).toBe('  juan  perez  ');
  });

  it('es idempotente sobre texto ya normalizado', () => {
    expect(normaliza('brian noel')).toBe('brian noel');
  });
});
