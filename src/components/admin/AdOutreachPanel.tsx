import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, X, ExternalLink, Mail, Building2, Clock, Loader2, Megaphone } from "lucide-react";

interface Lead {
  id: string; email: string; company_name: string | null; website: string | null;
  industry: string | null; country: string | null; status: string;
  contacted_at: string | null; created_at: string;
}
interface Campaign {
  id: string; company_name: string; contact_email: string; ad_title: string;
  ad_description: string; ad_url: string; ad_image_url: string | null;
  amount_eur: number; payment_status: string; publish_status: string;
  payment_deadline: string; expires_at: string; created_at: string;
  blog_post_id: string | null;
}

export default function AdOutreachPanel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sentToday: 0, totalLeads: 0, pendingPayments: 0, confirmedRevenue: 0 });

  const load = async () => {
    setLoading(true);
    const [leadsRes, campRes, countRes] = await Promise.all([
      supabase.from("ad_leads").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("ad_campaigns").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.rpc("ad_outreach_daily_count"),
    ]);
    setLeads((leadsRes.data || []) as Lead[]);
    const camps = (campRes.data || []) as Campaign[];
    setCampaigns(camps);
    setStats({
      sentToday: countRes.data || 0,
      totalLeads: leadsRes.data?.length || 0,
      pendingPayments: camps.filter(c => c.payment_status === "pending").length,
      confirmedRevenue: camps.filter(c => c.payment_status === "confirmed").reduce((s, c) => s + Number(c.amount_eur), 0),
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const confirm = async (id: string) => {
    const ref = prompt("Podaj numer referencyjny przelewu (opcjonalnie):") || null;
    const { error } = await supabase.rpc("admin_confirm_ad_payment", { _campaign_id: id, _reference: ref });
    if (error) toast({ title: "Błąd", description: error.message, variant: "destructive" });
    else { toast({ title: "Płatność potwierdzona ✅" }); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm) return;
    const ok = window.confirm("Usunąć reklamę z bloga?");
    if (!ok) return;
    const { error } = await supabase.rpc("admin_remove_ad_campaign", { _campaign_id: id });
    if (error) toast({ title: "Błąd", description: error.message, variant: "destructive" });
    else { toast({ title: "Reklama usunięta" }); load(); }
  };

  const expireUnpaid = async () => {
    const { data, error } = await supabase.rpc("expire_unpaid_ad_campaigns");
    if (error) toast({ title: "Błąd", description: error.message, variant: "destructive" });
    else { toast({ title: `Wygaszono ${data} reklam` }); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" /> Bot reklamowy
          </h2>
          <p className="text-sm text-muted-foreground">Autonomiczna akwizycja reklamodawców · n8n + Firecrawl</p>
        </div>
        <Button variant="outline" onClick={expireUnpaid}>Wygaś nieopłacone (24h+)</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Wysłano dziś</div>
          <div className="text-2xl font-bold">{stats.sentToday} / 20</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Leady</div>
          <div className="text-2xl font-bold">{stats.totalLeads}</div>
        </Card>
        <Card className="p-4 border-primary/30">
          <div className="text-xs text-primary uppercase">Czekają na opłatę</div>
          <div className="text-2xl font-bold">{stats.pendingPayments}</div>
        </Card>
        <Card className="p-4 border-primary/30">
          <div className="text-xs text-primary uppercase">Przychód (potwierdzony)</div>
          <div className="text-2xl font-bold">{stats.confirmedRevenue.toFixed(2)} €</div>
        </Card>
      </div>

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Reklamy ({campaigns.length})</TabsTrigger>
          <TabsTrigger value="leads">Leady ({leads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-3">
          {loading ? <Loader2 className="animate-spin" /> : campaigns.length === 0 ? (
            <p className="text-muted-foreground text-sm">Brak kampanii. Bot je tu doda automatycznie.</p>
          ) : campaigns.map(c => {
            const overdue = c.payment_status === "pending" && new Date(c.payment_deadline) < new Date();
            return (
              <Card key={c.id} className={`p-4 ${overdue ? "border-destructive/40" : ""}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={c.payment_status === "confirmed" ? "default" : c.payment_status === "pending" ? "secondary" : "destructive"}>
                        {c.payment_status}
                      </Badge>
                      <Badge variant="outline">{c.publish_status}</Badge>
                      {overdue && <Badge variant="destructive">⏱ Po terminie</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleString("pl-PL")}
                      </span>
                    </div>
                    <div className="font-semibold">{c.company_name} · <span className="text-primary">{c.ad_title}</span></div>
                    <div className="text-sm text-muted-foreground line-clamp-2">{c.ad_description}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                      <span><Mail className="w-3 h-3 inline" /> {c.contact_email}</span>
                      <a href={c.ad_url} target="_blank" rel="noreferrer" className="text-primary hover:underline"><ExternalLink className="w-3 h-3 inline" /> {c.ad_url.slice(0, 40)}…</a>
                      <span><Clock className="w-3 h-3 inline" /> Deadline: {new Date(c.payment_deadline).toLocaleString("pl-PL")}</span>
                      <span className="font-bold text-foreground">{c.amount_eur} €</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {c.payment_status === "pending" && (
                      <Button size="sm" onClick={() => confirm(c.id)}><CheckCircle2 className="w-4 h-4 mr-1" /> Potwierdź wpłatę</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><X className="w-4 h-4" /></Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="leads" className="space-y-2">
          {leads.length === 0 ? (
            <p className="text-muted-foreground text-sm">Brak leadów. n8n bot doda je automatycznie.</p>
          ) : leads.map(l => (
            <Card key={l.id} className="p-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium truncate">{l.company_name || l.email}</span>
                  <Badge variant={l.status === "converted" ? "default" : l.status === "sent" ? "secondary" : "outline"}>{l.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                  <span>{l.email}</span>
                  {l.industry && <span>· {l.industry}</span>}
                  {l.country && <span>· {l.country}</span>}
                  {l.website && <a href={l.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">↗ www</a>}
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {l.contacted_at ? `📧 ${new Date(l.contacted_at).toLocaleDateString("pl-PL")}` : "—"}
              </span>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
