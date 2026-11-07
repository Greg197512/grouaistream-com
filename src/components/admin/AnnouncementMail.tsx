// Gotowy mail „Nowości” (czat woła na telefon + sklep GrouaDrop) — podgląd, próba do siebie, wysyłka do wszystkich zarejestrowanych.
// Wysyła istniejące api/admin-email (mode single/mass, tylko admin) — bez AI, bez kosztów.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const SITE = "https://grouaistream.com";
export const ANNOUNCE_SUBJECT = "Hej, jesteś?! 👋 GrouAI woła Cię na telefon + nowy sklep GrouaDrop";

const img = (src: string, alt: string) =>
  `<img src="${SITE}${src}" alt="${alt}" width="128" height="128" style="width:128px;height:128px;border-radius:14px;object-fit:cover;display:inline-block;margin:0 4px 8px 0;border:1px solid #e4e4e7">`;

export const ANNOUNCE_HTML = `
<h1 style="font-size:26px;line-height:1.2;margin:0 0 6px;color:#f97316">Hej, jesteś?! 👋</h1>
<p style="margin:0 0 18px;font-size:16px">Mamy dla Ciebie dwie nowości w GrouAI Stream.</p>

<h2 style="font-size:19px;margin:0 0 6px">💬 Czat GrouAI zawoła Cię, gdy ktoś napisze</h2>
<p style="margin:0 0 10px">Gdy ktoś wyśle Ci wiadomość, usłyszysz głośne <b>„Hej, jesteś?!”</b>, a telefon pokaże powiadomienie —
<b>nawet gdy aplikacja jest wyłączona</b>. Wystarczy raz kliknąć <b>„Włącz”</b> w czacie.</p>
<p style="margin:0 0 6px;font-size:13px;color:#52525b">iPhone: w Safari wybierz Udostępnij → „Do ekranu początkowego”, otwórz GrouAI z ikony i tam kliknij „Włącz”.</p>
<p style="margin:12px 0 26px"><a href="${SITE}/?chat=open" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#18181b;color:#fff;font-weight:bold;text-decoration:none">Otwórz czat i włącz powiadomienia</a></p>

<h2 style="font-size:19px;margin:0 0 6px">🛍️ GrouaDrop — sklep dla ludzi, którzy żyją muzyką</h2>
<p style="margin:0 0 12px">Komplety z autorskimi nadrukami: <b>Komplet Studio</b> (bluza Bass Department, koszulka Louder, kubek, podkładka)
i <b>Nocna zmiana</b> (bluza After Hours, tank top, etui, plakat). Nowa karta <b>Gadżety</b>: okulary AI, asystent AI z ekranem,
słuchawki ANC, głośnik pixel-art i więcej.</p>
<div>${img("/shop/bassdept-1.jpg", "Bluza Bass Department")}${img("/shop/afterhours-1.jpg", "Bluza After Hours")}${img("/shop/okulary-ai.jpg", "Okulary AI")}${img("/shop/asystent-ai.jpg", "Asystent AI")}</div>
<p style="margin:12px 0 6px"><a href="${SITE}/shop" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#f97316;color:#111;font-weight:bold;text-decoration:none">Zobacz sklep</a>
&nbsp; <a href="${SITE}/shop/gadzety" style="color:#f97316;font-weight:bold">Gadżety →</a></p>
<p style="margin:22px 0 0">Do usłyszenia!<br>Zespół GrouAI Stream</p>`;

async function post(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const r = await fetch("/api/admin-email", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  const t = (await r.text()).trim();
  try { return JSON.parse(t) as { success?: boolean; sent?: number; errors?: number; recipientCount?: number; skipped?: number; error?: string }; }
  catch { return { success: false, error: t.slice(0, 200) || `HTTP ${r.status}` }; }
}

export function AnnouncementMail() {
  const { user } = useAuth();
  const [busy, setBusy] = useState<"" | "test" | "mass">("");
  const [done, setDone] = useState<string>("");

  const test = async () => {
    if (!user?.email) return;
    setBusy("test");
    const r = await post({ mode: "single", to: user.email, subject: ANNOUNCE_SUBJECT, html: ANNOUNCE_HTML });
    setBusy("");
    r.success ? toast.success(`Próba wysłana na ${user.email}`) : toast.error(r.error || "Nie wysłano próby");
  };

  const mass = async () => {
    if (!confirm(`Wysłać „${ANNOUNCE_SUBJECT}” do WSZYSTKICH zarejestrowanych? To pójdzie na żywo i nie da się cofnąć.`)) return;
    setBusy("mass");
    toast("Wysyłam… to potrwa do kilku minut, nie zamykaj karty.");
    const r = await post({ mode: "mass", audience: "all_users", subject: ANNOUNCE_SUBJECT, html: ANNOUNCE_HTML });
    setBusy("");
    const msg = `Wysłano ${r.sent ?? 0} z ${r.recipientCount ?? 0}${r.errors ? `, błędy: ${r.errors}` : ""}${r.skipped ? `, pominięte (wypisani): ${r.skipped}` : ""}`;
    setDone(msg);
    r.success ? toast.success(msg) : toast.error(r.error || msg);
  };

  return (
    <section className="rounded-2xl border border-orange-500/40 bg-orange-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold">📣 Gotowy mail: Nowości (czat + sklep)</h3>
          <p className="text-xs text-muted-foreground">Temat: {ANNOUNCE_SUBJECT}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void test()} disabled={!!busy} className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50">
            {busy === "test" ? "Wysyłam…" : "Próba do mnie"}
          </button>
          <button onClick={() => void mass()} disabled={!!busy} className="rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-50">
            {busy === "mass" ? "Wysyłam do wszystkich…" : "Wyślij do wszystkich"}
          </button>
        </div>
      </div>
      {done && <p className="mt-2 text-sm font-semibold text-orange-300">{done}</p>}
      <div className="mt-3 max-h-[420px] overflow-auto rounded-xl bg-white p-5 text-[#18181b]" dangerouslySetInnerHTML={{ __html: ANNOUNCE_HTML }} />
    </section>
  );
}
