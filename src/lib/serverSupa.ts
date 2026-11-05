// Wspólne pomocniki funkcji Vercel (edge): env, JSON, zapytania PostgREST z tokenem użytkownika (RLS), rola admina.
export const env = (k: string): string | undefined => {
  const v = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env?.[k];
  return v && v.trim() ? v.trim() : undefined;
};
export const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export function supa() {
  const url = (env("VITE_SUPABASE_URL") ?? env("SUPABASE_URL"))?.replace(/\/$/, "");
  const key = env("SUPABASE_ANON_KEY") ?? env("VITE_SUPABASE_PUBLISHABLE_KEY");
  return url && key ? { url, key } : null;
}
export async function rest(auth: string, path: string, init: RequestInit = {}) {
  const s = supa()!;
  const r = await fetch(`${s.url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: s.key, authorization: auth, "content-type": "application/json", prefer: "return=representation", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15000),
  });
  const text = await r.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: r.ok, status: r.status, data };
}
export type SbUser = { id: string; email: string | null; name: string | null };
export async function getUser(auth: string): Promise<SbUser | null> {
  const s = supa();
  if (!s || !/^Bearer\s+\S+/.test(auth)) return null;
  try {
    const r = await fetch(`${s.url}/auth/v1/user`, { headers: { apikey: s.key, authorization: auth }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const u = (await r.json()) as { id?: string; email?: string; user_metadata?: Record<string, string> };
    return u.id ? { id: u.id, email: u.email ?? null, name: u.user_metadata?.display_name ?? u.user_metadata?.full_name ?? null } : null;
  } catch { return null; }
}
export async function isAdmin(auth: string, userId: string) {
  const r = await rest(auth, "rpc/has_role", { method: "POST", body: JSON.stringify({ _user_id: userId, _role: "admin" }) });
  return r.ok && r.data === true;
}
export const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
