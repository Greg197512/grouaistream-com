import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, RefreshCw, TrendingUp, AlertTriangle, FileText, Send, Save, Database } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface ClientUsage {
  subscription_id: string;
  client_email: string;
  client_company: string | null;
  client_user_id: string | null;
  plan_code: string;
  plan_name: string;
  plan_storage_gb: number;
  plan_price_eur: number;
  status: string;
  storage_used_bytes: number;
  storage_used_gb: number;
  usage_percent: number;
  estimated_cost_eur: number;
  projected_usage_gb: number;
  r2_real_cost_eur: number;
  plan_margin_eur: number;
  current_period_end: string | null;
  paddle_subscription_id: string | null;
  suggested_upgrade: {
    plan_code: string;
    plan_name: string;
    storage_gb: number;
    price_eur: number;
    paddle_price_id: string;
    reason: string;
  } | null;
}

interface Plan {
  code: string;
  name: string;
  storage_gb: number;
  price_eur: number;
  paddle_price_id: string | null;
  active: boolean;
}

interface Settings {
  id: string;
  bucket_name: string;
  public_base_url: string;
  default_signed_ttl_days: number;
  margin_percent: number;
  cost_per_gb_eur: number;
  cost_per_gb_egress_eur: number;
  allow_public_assets: boolean;
  hard_block_on_quota: boolean;
  notes: string | null;
}

interface Offer {
  id: string;
  client_email: string;
  client_company: string | null;
  recommended_plan_code: string | null;
  current_usage_gb: number;
  projected_usage_gb: number;
  monthly_price_eur: number;
  margin_eur: number;
  rationale: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
}

export function AuroraStorageDesk() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientUsage[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  const [newOffer, setNewOffer] = useState({
    client_email: "",
    client_company: "",
    plan_code: "",
    rationale: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: r, error } = await supabase.functions.invoke("aurora-storage-usage-report");
      if (error) throw error;
      setClients(r.clients || []);
      setPlans(r.plans || []);
      setSettings(r.settings || null);
      setSummary(r.summary || null);

      const { data: o } = await supabase
        .from("aurora_storage_offers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      setOffers((o || []) as Offer[]);
    } catch (e: any) {
      console.error(e);
      toast.error("Błąd ładowania: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from("aurora_r2_settings")
        .update({
          bucket_name: settings.bucket_name,
          public_base_url: settings.public_base_url,
          default_signed_ttl_days: settings.default_signed_ttl_days,
          margin_percent: settings.margin_percent,
          cost_per_gb_eur: settings.cost_per_gb_eur,
          cost_per_gb_egress_eur: settings.cost_per_gb_egress_eur,
          allow_public_assets: settings.allow_public_assets,
          hard_block_on_quota: settings.hard_block_on_quota,
          notes: settings.notes,
        })
        .eq("id", settings.id);
      if (error) throw error;
      toast.success("Konfiguracja R2 zapisana");
    } catch (e: any) {
      toast.error("Błąd zapisu: " + e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const generateOfferFromClient = async (client: ClientUsage) => {
    if (!client.suggested_upgrade) return;
    try {
      const { error } = await supabase.functions.invoke("aurora-storage-offer-create", {
        body: {
          client_email: client.client_email,
          client_company: client.client_company,
          plan_code: client.suggested_upgrade.plan_code,
          current_usage_gb: client.storage_used_gb,
          projected_usage_gb: client.projected_usage_gb,
          rationale: client.suggested_upgrade.reason,
          expires_in_days: 14,
        },
      });
      if (error) throw error;
      toast.success(`Oferta ${client.suggested_upgrade.plan_name} utworzona dla ${client.client_email}`);
      refresh();
    } catch (e: any) {
      toast.error("Błąd: " + e.message);
    }
  };

  const createCustomOffer = async () => {
    if (!newOffer.client_email || !newOffer.plan_code) {
      toast.error("Email klienta i plan wymagane");
      return;
    }
    try {
      const { error } = await supabase.functions.invoke("aurora-storage-offer-create", {
        body: { ...newOffer, expires_in_days: 14 },
      });
      if (error) throw error;
      toast.success("Oferta utworzona");
      setNewOffer({ client_email: "", client_company: "", plan_code: "", rationale: "" });
      refresh();
    } catch (e: any) {
      toast.error("Błąd: " + e.message);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <Tabs defaultValue="clients" className="space-y-4">
      <TabsList>
        <TabsTrigger value="clients">Klienci R2</TabsTrigger>
        <TabsTrigger value="offers">Oferty <Badge variant="secondary" className="ml-2">{offers.length}</Badge></TabsTrigger>
        <TabsTrigger value="config"><Database className="w-3 h-3 mr-1" />Konfiguracja</TabsTrigger>
      </TabsList>

      {/* === CLIENTS === */}
      <TabsContent value="clients" className="space-y-4">
        {summary && (
          <div className="grid md:grid-cols-5 gap-3">
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{summary.total_clients}</div><div className="text-xs text-muted-foreground">klientów</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{summary.total_used_gb} GB</div><div className="text-xs text-muted-foreground">zużycie razem</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-500">€{summary.total_revenue_eur}</div><div className="text-xs text-muted-foreground">przychód MRR</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-orange-500">€{summary.total_r2_cost_eur}</div><div className="text-xs text-muted-foreground">koszt R2</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-emerald-500">€{summary.total_margin_eur}</div><div className="text-xs text-muted-foreground">marża miesięczna</div></CardContent></Card>
          </div>
        )}

        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Wykorzystanie R2 / klient</h3>
          <Button size="sm" variant="outline" onClick={refresh}><RefreshCw className="w-3 h-3 mr-1" />Odśwież</Button>
        </div>

        <div className="space-y-2">
          {clients.length === 0 && <p className="text-sm text-muted-foreground">Brak aktywnych klientów storage.</p>}
          {clients.map(c => (
            <Card key={c.subscription_id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{c.client_email}</span>
                      {c.client_company && <Badge variant="outline">{c.client_company}</Badge>}
                      <Badge>{c.plan_name}</Badge>
                      <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {c.storage_used_gb} / {c.plan_storage_gb} GB · koszt R2: €{c.r2_real_cost_eur} · marża: <span className={c.plan_margin_eur > 0 ? "text-green-500" : "text-red-500"}>€{c.plan_margin_eur}</span>
                    </div>
                  </div>
                  {c.suggested_upgrade && (
                    <Button size="sm" onClick={() => generateOfferFromClient(c)}>
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Oferta {c.suggested_upgrade.plan_name}
                    </Button>
                  )}
                </div>
                <Progress value={Math.min(c.usage_percent, 100)} className={c.usage_percent > 90 ? "[&>div]:bg-red-500" : c.usage_percent > 75 ? "[&>div]:bg-orange-500" : ""} />
                {c.usage_percent > 90 && (
                  <div className="flex items-center gap-2 text-xs text-red-500">
                    <AlertTriangle className="w-3 h-3" /> Przekroczono 90% — uploads wkrótce zablokowane
                  </div>
                )}
                {c.suggested_upgrade && (
                  <p className="text-xs text-muted-foreground italic">💡 {c.suggested_upgrade.reason}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      {/* === OFFERS === */}
      <TabsContent value="offers" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nowa oferta storage</CardTitle>
            <CardDescription>Aurora wyliczy marżę i wygeneruje propozycję dla klienta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <Input placeholder="email klienta" value={newOffer.client_email} onChange={e => setNewOffer({ ...newOffer, client_email: e.target.value })} />
              <Input placeholder="firma (opcjonalnie)" value={newOffer.client_company} onChange={e => setNewOffer({ ...newOffer, client_company: e.target.value })} />
            </div>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={newOffer.plan_code} onChange={e => setNewOffer({ ...newOffer, plan_code: e.target.value })}>
              <option value="">— wybierz plan —</option>
              {plans.map(p => (
                <option key={p.code} value={p.code}>{p.name} — {p.storage_gb}GB — €{p.price_eur}/mc</option>
              ))}
            </select>
            <Textarea placeholder="uzasadnienie oferty (opcjonalne — Aurora wypełni jeśli puste)" value={newOffer.rationale} onChange={e => setNewOffer({ ...newOffer, rationale: e.target.value })} rows={2} />
            <Button onClick={createCustomOffer}><Send className="w-3 h-3 mr-1" />Wygeneruj ofertę</Button>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Ostatnie oferty</h3>
          {offers.length === 0 && <p className="text-sm text-muted-foreground">Brak ofert.</p>}
          {offers.map(o => (
            <Card key={o.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span className="font-semibold">{o.client_email}</span>
                      {o.client_company && <Badge variant="outline">{o.client_company}</Badge>}
                      <Badge>{o.recommended_plan_code}</Badge>
                      <Badge variant="secondary">{o.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      €{o.monthly_price_eur}/mc · marża €{o.margin_eur} · ważna do {o.expires_at ? new Date(o.expires_at).toLocaleDateString() : "—"}
                    </div>
                    {o.rationale && <p className="text-xs mt-2">{o.rationale}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      {/* === CONFIG === */}
      <TabsContent value="config" className="space-y-4">
        {settings && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Konfiguracja Cloudflare R2</CardTitle>
              <CardDescription>Ustawienia bucketa, marży, kosztów i polityk dostępu. Połączenie z R2 jest przez Lovable Cloud — klucze zarządzane automatycznie.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>Nazwa bucketa</Label>
                  <Input value={settings.bucket_name || ""} onChange={e => setSettings({ ...settings, bucket_name: e.target.value })} placeholder="grouai-r2" />
                </div>
                <div>
                  <Label>Publiczny base URL</Label>
                  <Input value={settings.public_base_url} onChange={e => setSettings({ ...settings, public_base_url: e.target.value })} />
                </div>
                <div>
                  <Label>TTL podpisanych linków (dni)</Label>
                  <Input type="number" value={settings.default_signed_ttl_days} onChange={e => setSettings({ ...settings, default_signed_ttl_days: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Marża %</Label>
                  <Input type="number" step="0.1" value={settings.margin_percent} onChange={e => setSettings({ ...settings, margin_percent: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Koszt R2 / GB (EUR)</Label>
                  <Input type="number" step="0.0001" value={settings.cost_per_gb_eur} onChange={e => setSettings({ ...settings, cost_per_gb_eur: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Koszt egress / GB (EUR)</Label>
                  <Input type="number" step="0.0001" value={settings.cost_per_gb_egress_eur} onChange={e => setSettings({ ...settings, cost_per_gb_egress_eur: Number(e.target.value) })} />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <div className="font-medium text-sm">Publiczne assety</div>
                  <div className="text-xs text-muted-foreground">Pozwól na publiczne URLe dla landingów / OG / sitemap</div>
                </div>
                <Switch checked={settings.allow_public_assets} onCheckedChange={v => setSettings({ ...settings, allow_public_assets: v })} />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <div className="font-medium text-sm">Twardy block po przekroczeniu limitu</div>
                  <div className="text-xs text-muted-foreground">Blokuj uploady gdy klient przekroczy quota planu</div>
                </div>
                <Switch checked={settings.hard_block_on_quota} onCheckedChange={v => setSettings({ ...settings, hard_block_on_quota: v })} />
              </div>

              <div>
                <Label>Notatki</Label>
                <Textarea value={settings.notes || ""} onChange={e => setSettings({ ...settings, notes: e.target.value })} rows={2} />
              </div>

              <Button onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                Zapisz ustawienia
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plany storage (Paddle)</CardTitle>
            <CardDescription>Plany podpięte do Paddle — checkout w aplikacji, auto-grant po opłacie.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {plans.map(p => (
              <div key={p.code} className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <div className="font-semibold">{p.name} <Badge variant="outline" className="ml-2">{p.storage_gb}GB</Badge></div>
                  <div className="text-xs text-muted-foreground">code: {p.code} · paddle: {p.paddle_price_id || <span className="text-red-500">brak</span>}</div>
                </div>
                <div className="text-lg font-bold">€{p.price_eur}/mc</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
