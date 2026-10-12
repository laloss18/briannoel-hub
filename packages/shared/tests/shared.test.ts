import { describe, expect, it } from 'vitest';
import { hasPermission, approvalSteps } from '../src/permissions';
import { ROLE_PERMISSIONS, type Permission, type Role } from '../src/constants';
import { appConfigSchema, appUserSchema, identidadDe, sessionSchema, usernameSchema, type IdentidadIndice } from '../src/schemas';

const ROLES: readonly Role[] = ['admin', 'supervisor', 'promotor', 'cobrador'];

describe('matriz de permisos (PRD §3.2/§3.3)', () => {
  it('todo rol tiene al menos un permiso definido', () => {
    for (const role of ROLES) {
      expect(ROLE_PERMISSIONS[role].length, `rol ${role}`).toBeGreaterThan(0);
    }
  });

  it('admin autoriza crédito y edita clientes; promotor no ve saldos', () => {
    expect(hasPermission('authorize_credit', ['admin'])).toBe(true);
    expect(hasPermission('edit_client', ['admin', 'supervisor'])).toBe(true);
    expect(hasPermission('view_saldos', ['promotor'])).toBe(false);
    expect(hasPermission('delete_dispatch_pending', ['promotor'])).toBe(true);
  });

  it('cobrador cierra rutas y ve saldos, no aprueba créditos', () => {
    expect(hasPermission('close_route', ['cobrador'])).toBe(true);
    expect(hasPermission('view_saldos', ['cobrador'])).toBe(true);
    expect(hasPermission('authorize_credit', ['cobrador'])).toBe(false);
  });

  it('múltiples roles se combinan (unión de permisos)', () => {
    expect(hasPermission('authorize_credit', ['promotor', 'supervisor'])).toBe(true);
    expect(hasPermission('view_kpis', ['cobrador', 'admin'])).toBe(true);
  });

  it('permiso no concedido devuelve false (sin excepción)', () => {
    expect(hasPermission('unknown' as Permission, ['admin'])).toBe(false);
  });

  it('verifica TODOS los permisos del PRD, no solo los clave', () => {
    const list: Permission[] = [
      'authorize_credit',
      'edit_client',
      'delete_dispatch_pending',
      'close_route',
      'view_saldos',
      'view_kpis',
      'discount',
    ];
    for (const p of list) {
      expect(hasPermission(p, ['admin']), `admin debería poder ${p}`).toBe(true);
    }
    // Promotor únicamente elimina despachos pendientes.
    for (const p of list) {
      if (p === 'delete_dispatch_pending') continue;
      expect(hasPermission(p, ['promotor']), `promotor NO debería poder ${p}`).toBe(false);
    }
  });
});

describe('approvalSteps (pasos de aprobación §3.3)', () => {
  it('admin aprueba crédito en 1 paso, supervisor en 2', () => {
    expect(approvalSteps('authorize_credit', ['admin'])).toBe(1);
    expect(approvalSteps('authorize_credit', ['supervisor'])).toBe(2);
  });

  it('descuento igual: admin 1, supervisor 2', () => {
    expect(approvalSteps('discount', ['admin'])).toBe(1);
    expect(approvalSteps('discount', ['supervisor'])).toBe(2);
  });

  it('sin rol aprobador → null', () => {
    expect(approvalSteps('authorize_credit', ['promotor'])).toBeNull();
  });

  it('múltiples roles aprueban con la menor cantidad de pasos', () => {
    expect(approvalSteps('authorize_credit', ['supervisor', 'admin'])).toBe(1);
  });

  it('permisos sin pasos definidos devuelven null', () => {
    expect(approvalSteps('view_saldos', ['admin'])).toBeNull();
  });
});

describe('schemas Fase 1', () => {
  it('sessionSchema valida una sesión cacheada offline', () => {
    const ok = sessionSchema.safeParse({
      user_id: 'u-1',
      email: 'a@b.co',
      roles: ['admin', 'supervisor'],
      access_token: 'at',
      refresh_token: 'rt',
      last_active_at: '2024-01-01T00:00:00.000Z',
    });
    expect(ok.success).toBe(true);
    // Rol inválido no pasa.
    const bad = sessionSchema.safeParse({
      user_id: 'u-1',
      email: 'a@b.co',
      roles: ['jefe'],
      access_token: 'at',
      refresh_token: 'rt',
      last_active_at: '2024-01-01T00:00:00.000Z',
    });
    expect(bad.success).toBe(false);
  });

  it('appConfigSchema admite id fijo global y tasa opcional', () => {
    const ok = appConfigSchema.safeParse({
      id: 'global',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      deleted_at: null,
      base_currency: 'BsD',
      bcv_rate: 36.5,
      bcv_rate_source: 'BCV_API',
    });
    expect(ok.success).toBe(true);
    const minimal = appConfigSchema.safeParse({
      id: 'global',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      deleted_at: null,
    });
    expect(minimal.success).toBe(true);
  });
});

describe('identidad por nombre de usuario (PRD §3.4)', () => {
  it('usernameSchema acepta nombres con acentos, espacios y puntuación', () => {
    for (const ok of ['luis', 'brian.noel', 'María José', "O'Brien", 'Ana-03', 'Luis P.']) {
      expect(usernameSchema.safeParse(ok).success, ok).toBe(true);
    }
  });

  it('usernameSchema rechaza símbolos raros, vacío y longitudes extremas', () => {
    for (const bad of ['user@host', 'a#b', 'ab', '', 'a'.repeat(41), '<script>']) {
      expect(usernameSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('sessionSchema acepta sesión con y sin username (compatibilidad offline)', () => {
    const base = {
      user_id: 'u-1',
      email: 'luis@brian.com',
      roles: ['admin'],
      access_token: 'a',
      refresh_token: 'r',
      last_active_at: '2024-01-01T00:00:00.000Z',
    };
    expect(sessionSchema.safeParse({ ...base, username: 'luis' }).success).toBe(true);
    expect(sessionSchema.safeParse(base).success).toBe(true);
    expect(sessionSchema.safeParse({ ...base, username: 'Luis Pérez' }).success).toBe(true);
    expect(sessionSchema.safeParse({ ...base, username: 'u$er' }).success).toBe(false);
  });

  it('identidadDe resuelve el username y cae al email si no hay índice o no está', () => {
    const indice: IdentidadIndice = new Map([['luis@brian.com', 'luis']]);
    expect(identidadDe(indice, 'luis@brian.com')).toBe('luis');
    expect(identidadDe(indice, 'Luis@Brian.com')).toBe('luis');
    expect(identidadDe(indice, 'otro@brian.com')).toBe('otro@brian.com');
    expect(identidadDe(undefined, 'otro@brian.com')).toBe('otro@brian.com');
    expect(identidadDe(indice, null)).toBe('—');
  });

  it('appUserSchema acepta perfiles sin username (pre-0009) y valida roles', () => {
    const base = {
      id: '09ce4f19-0130-4184-a5da-22f2c1b61c3f',
      user_id: '09ce4f19-0130-4184-a5da-22f2c1b61c3f',
      email: 'luis@brian.com',
      roles: ['admin'],
      active: true,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      deleted_at: null,
    };
    expect(appUserSchema.safeParse({ ...base, username: 'luis' }).success).toBe(true);
    expect(appUserSchema.safeParse(base).success).toBe(true);
    expect(appUserSchema.safeParse({ ...base, username: 'l' }).success).toBe(false);
    expect(appUserSchema.safeParse({ ...base, roles: ['otro'] }).success).toBe(false);
  });
});
