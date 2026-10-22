import { supabase } from "@/integrations/supabase/client";

// Wygenerowane typy Supabase (src/integrations/supabase/types.ts) nie znają jeszcze
// niektórych tabel i funkcji RPC dodanych później do bazy. Zamiast rozsianych `any`
// w komponentach, używamy tego jednego, jawnego obejścia dla takich wywołań.
// Uwaga: zapytania przez `rawDb` NIE mają podpowiedzi typów — trzymaj kształty wyników
// po stronie komponentu (np. przez własne interfejsy).
export interface RawDb {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export const rawDb = supabase as unknown as RawDb;
