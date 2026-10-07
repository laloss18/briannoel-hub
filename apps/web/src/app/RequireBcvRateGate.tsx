import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Role } from '@brian/shared';
import { hasPermission } from '@brian/shared';
import { getAppConfig, saveBcvRate } from '../bimoneda/appConfig';
import TasaRequerida from './TasaRequerida';

/** Contexto del gate de tasa BCV: comparte estado entre el shell y la página. */
interface TasaGateCtx {
  /** `null` significa sin tasa (no entra al hub). */
  tasa: number | null;
  source: 'BCV_API' | 'manual' | null;
  /** Actualiza desde API oficial. Retorna la tasa obtenida o `null` si falló. */
  refrescar: () => Promise<number | null>;
  /** Guarda tasa manual (admin/supervisor con `view_kpis`). */
  guardarManual: (v: number) => Promise<void>;
  refrescando: boolean;
}

const Ctx = createContext<TasaGateCtx | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useTasaGate(): TasaGateCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTasaGate fuera de RequireBcvRateProvider');
  return v;
}

async function fetchBcvApi(): Promise<number> {
  const url =
    (import.meta.env.VITE_BCV_API_URL as string | undefined) ??
    'https://pydolarve.org/api/v1/dollar?type=bcv';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`BCV API HTTP ${res.status}`);
  const json = await res.json();
  // pydolarve usualmente devuelve { price, ... } o { rates: { bcv: ... } }
  const valor =
    json?.price ??
    json?.bcv ??
    json?.dollar?.bcv ??
    json?.rates?.bcv ??
    json?.value ??
    (Array.isArray(json) ? json[0]?.price : undefined);
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    throw new Error('Respuesta de BCV sin tasa válida');
  }
  return valor;
}

/**
 * Provider + gate de tasa BCV obligatorio (PRD §2.6, §7.4). El hijo solo se
 * renderiza cuando existe una tasa configurada (`bcv_rate` presente). En caso
 * contrario, el shell deja pasar esta rama y mostramos `TasaRequerida` para que
 * el admin/supervisor la configure (API oficial o manual). El resto de roles
 * ven la página en modo lectura pero el gate impide operar hasta que haya tasa.
 */
export default function RequireBcvRateProvider({
  roles,
  children,
}: {
  roles: readonly Role[];
  children: React.ReactNode;
}) {
  const config = useLiveQuery(() => getAppConfig(), []);
  const [refrescando, setRefrescando] = useState(false);
  const canEdit = hasPermission('view_kpis', roles);

  const tasa = config?.bcv_rate ?? null;
  const source = config?.bcv_rate_source ?? null;

  useEffect(() => {
    // Auto-intento de obtener tasa oficial si no existe (sin bloquear UI). Solo
    // cuando hay conexión y el usuario tiene permiso para editarla, pero el gate
    // también funciona para lectura (muestra la pantalla hasta tener tasa).
    if (tasa === null && !refrescando) {
      void refrescar().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasa]);

  const refrescar = useCallback(async (): Promise<number | null> => {
    if (!canEdit) return tasa;
    setRefrescando(true);
    try {
      const v = await fetchBcvApi();
      await saveBcvRate(v, 'BCV_API');
      return v;
    } catch {
      return null;
    } finally {
      setRefrescando(false);
    }
  }, [canEdit, tasa]);

  const guardarManual = useCallback(async (v: number): Promise<void> => {
    if (!canEdit) throw new Error('No tienes permiso para configurar la tasa');
    await saveBcvRate(v, 'manual');
  }, [canEdit]);

  const valor = useMemo<TasaGateCtx>(
    () => ({ tasa, source, refrescar, guardarManual, refrescando }),
    [tasa, source, refrescar, guardarManual, refrescando],
  );

  // Gate obligatorio: sin tasa → pantalla de configuración. Con tasa → hub.
  return (
    <Ctx.Provider value={valor}>
      {tasa === null ? <TasaRequerida roles={roles} /> : children}
    </Ctx.Provider>
  );
}