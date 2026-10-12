import { beforeEach, describe, expect, it } from 'vitest';
import type { Consentimiento } from '@brian/shared';
import { crearClienteLocal, editarClienteLocal, listClientes } from './clientesRepo';
import { hub } from '../sync/db';

const CONSENT: Consentimiento = {
  fecha: '2026-01-01T00:00:00.000Z',
  foto_casa: false,
  foto_documento: false,
  aviso_documento: false,
};

const CREADOR = 'tester@example.com';
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const nuevo = (nombre: string) => ({
  nombre,
  documento: 'V-1',
  telefono: '0414-0000000',
  consentimiento: CONSENT,
  creado_por: CREADOR,
});

beforeEach(async () => {
  await Promise.all([
    hub.records.clear(),
    hub.outbox.clear(),
    hub.cursors.clear(),
    hub.events.clear(),
  ]);
});

describe('crearClienteLocal', () => {
  it('persiste en el mirror, genera ULID y encola un create', async () => {
    const cliente = await crearClienteLocal(nuevo('Ana Pérez'), []);

    expect(cliente.id).toMatch(ULID);
    expect(cliente.created_by).toBe(CREADOR);

    const lista = await listClientes();
    expect(lista).toHaveLength(1);
    expect(lista[0]?.nombre).toBe('Ana Pérez');

    const outbox = await hub.outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.entity).toBe('clientes');
    expect(outbox[0]?.operation).toBe('create');
  });

  it('respeta el zonaOverride de la venta sobre la zona calculada', async () => {
    const cliente = await crearClienteLocal(nuevo('Sin geo'), [], 'zona-fija');
    expect(cliente.zona_id).toBe('zona-fija');
  });
});

describe('editarClienteLocal', () => {
  it('actualiza campos y encola un update además del create', async () => {
    const creado = await crearClienteLocal(nuevo('Ana Pérez'), []);
    const editado = await editarClienteLocal(creado, CREADOR, [], { nombre: 'Ana G.' });

    expect(editado.nombre).toBe('Ana G.');
    expect((await listClientes())[0]?.nombre).toBe('Ana G.');

    const ops = (await hub.outbox.toArray()).map((o) => o.operation).sort();
    expect(ops).toEqual(['create', 'update']);
  });
});

describe('listClientes', () => {
  it('excluye los clientes con soft-delete', async () => {
    const creado = await crearClienteLocal(nuevo('Ana Pérez'), []);
    const row = await hub.records.get(creado.id);
    await hub.records.put({ ...row!, deleted_at: '2026-01-02T00:00:00.000Z' });

    expect(await listClientes()).toHaveLength(0);
  });
});
