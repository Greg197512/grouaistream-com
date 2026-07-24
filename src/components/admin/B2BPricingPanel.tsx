import { useCallback, useEffect, useState } from "react";
import { Euro, Loader2, RefreshCw, Save, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Panel admina: ceny usług B2B. Zapis idzie do hub_config.price_<segment>
// przez hub-funkcję hub-pricing; stamtąd aurora-b2b-flow pobiera ceny przy wycenie.
const HUB_PRICING_URL = "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/hub-pricing";

interface Svc { key: string; label: string; price: number; isDefault?: boolean }

export function B2BPricingPanel() {
  const [services, setServices] = useState<Svc[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState<string>(() => localStorage.getItem("b2b-pricing-pin") || "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(HUB_PRICING_URL);
      const d = await r.json();
      if (d?.ok) {
        setServices(d.services);
        const init: Record<string, string> = {};
        for (const s of d.services) init[s.key] = String(s.price);
        setEdited(init);
      } else throw new Error(d?.error || "błąd");
    } catch (e: any) {
      toast.error("Nie udało się pobrać cen: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!pin.trim()) { toast.error("Podaj PIN admina, żeby zapisać ceny"); return; }
    setSaving(true);
    try {
      const prices: Record<string, number> = {};
      for (const s of services) {
        const v = parseFloat(edited[s.key]);
        if (isFinite(v) && v > 0) prices[s.key] = v;
      }
      const r = await fetch(HUB_PRICING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim(), prices }),
      });
      const d = await r.json();
      if (!d?.ok) throw new Error(d?.error || "błąd zapisu");
      localStorage.setItem("b2b-pricing-pin", pin.trim());
      setServices(d.services);
      toast.success(`✅ Zapisano ceny (${d.saved}). Aurora użyje ich przy nowych wycenach.`);
    } catch (e: any) {
      toast.error("Zapis nieudany: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Euro className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold text-lg">Ceny usług B2B</h3>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Odśwież
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Aurora wycenia nowe zlecenia automatycznie wg tych stawek. Zmień kwoty i zapisz —
        przepływ B2B (oferta/faktura) pobiera je od razu.
      </p>

      {loading && services.length === 0 ? (
        <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline-block" /></div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
          {services.map((s) => (
            <div key={s.key} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{s.label}</div>
                <div className="text-[10px] text-muted-foreground">{s.key}{s.isDefault ? " · domyślna" : ""}</div>
              </div>
              <div className="relative w-32">
                <Euro className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="number" min="1" step="1"
                  value={edited[s.key] ?? ""}
                  onChange={(e) => setEdited((p) => ({ ...p, [s.key]: e.target.value }))}
                  className="pl-7 h-9 text-right font-semibold"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zapis z PIN-em */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Lock className="h-4 w-4 text-primary" /> Zapis wymaga PIN-u admina
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="password"
            placeholder="PIN admina"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="sm:max-w-[220px]"
          />
          <Button onClick={() => void save()} disabled={saving || loading} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Zapisz ceny
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          PIN zapamiętuje się w tej przeglądarce. Pojedyncze zlecenie można też nadpisać
          dopisując <code>&amp;amount=250</code> do linku potwierdzenia w mailu.
        </p>
      </div>
    </div>
  );
}
