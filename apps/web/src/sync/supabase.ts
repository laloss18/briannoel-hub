import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase con clave PUBLISHABLE (sb_publishable_*) — segura para el
 * cliente (equivalente a la antigua anon key; PRD §6.4 y AGENTS.md colapso a 1 proyecto).
 * La SECRET key (sb_secret_*) JAMÁS vive aquí ni en el cliente: solo local
 * (migrations/admin) y como GitHub secret para los workflows de backup.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && publishable ? createClient(url, publishable) : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Falta VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY en apps/web/.env.local',
    );
  }
  return supabase;
}
