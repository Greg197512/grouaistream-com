// Pełnoekranowy dashboard zleceniodawcy — mapa działań, Aurora-negocjator, dokumenty, kalendarz, notatki, kalkulator, CRM firm
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Map, MessageCircle, FileText, Calendar as CalIcon, NotebookPen, Calculator, Building2, Sparkles, ArrowRight } from "lucide-react";
import { OrderWorkflowMap } from "@/components/dashboard/OrderWorkflowMap";
import { AuroraNegotiatorPanel } from "@/components/dashboard/AuroraNegotiatorPanel";
import { InvoicesPanel } from "@/components/dashboard/InvoicesPanel";
import { CalendarPanel } from "@/components/dashboard/CalendarPanel";
import { NotesPanel } from "@/components/dashboard/NotesPanel";
import { CalculatorPanel } from "@/components/dashboard/CalculatorPanel";
import { PartnerCRMPanel } from "@/components/dashboard/PartnerCRMPanel";
import auroraAvatar from "@/assets/aurora-avatar.jpg";
import { toast } from "sonner";

interface Order {
  id: string; service_type: string; brief: string; status: string;
  payment_status: string; price_eur: number; created_at: string;
  workflow_map: any; progress_pct: number;
}

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [params] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(params.get("order"));
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("workflow");
  const [generatingPlan, setGeneratingPlan] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const loadOrders = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("aurora_business_orders")
      .select("id, service_type, brief, status, payment_status, price_eur, created_at, workflow_map, progress_pct")
      .eq("user_id", user.id)
      .in("payment_status", ["paid", "completed"])
      .order("created_at", { ascending: false });
    setOrders((data ?? []) as Order[]);
    if (!activeOrderId && data && data.length > 0) setActiveOrderId(data[0].id);
    setLoading(false);
  };

  useEffect(() => { loadOrders(); }, [user]);

  const activeOrder = useMemo(() => orders.find(o => o.id === activeOrderId), [orders, activeOrderId]);

  const generatePlan = async () => {
    if (!activeOrder) return;
    setGeneratingPlan(true);
    const { data, error } = await supabase.functions.invoke("aurora-plan-generate", {
      body: { order_id: activeOrder.id },
    });
    setGeneratingPlan(false);
    if (error || !(data as any)?.ok) {
      toast.error("Aurora nie mogła wygenerować planu", { description: (data as any)?.error ?? error?.message });
      return;
    }
    toast.success(`Mapa gotowa — ${(data as any).steps_count} etapów`);
    loadOrders();
  };

  if (authLoading || loading) {
    return (
      <MainLayout><div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin" /></div></MainLayout>
    );
  }

  if (orders.length === 0) {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto py-12 px-4 text-center space-y-6">
          <div className="text-6xl">🎯</div>
          <h1 className="text-3xl font-bold">Brak opłaconych zleceń</h1>
          <p className="text-muted-foreground">
            Dashboard zleceniodawcy aktywuje się po pierwszym opłaconym zleceniu B2B. Zamów usługę u Aurory żeby zobaczyć tu mapę działań, dokumenty i panele zarządzania.
          </p>
          <Button onClick={() => navigate("/business")} size="lg" className="gap-2">
            Zamów usługę B2B <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6 space-y-4">
        {/* Header z Aurorą */}
        <Card className="overflow-hidden border-orange-500/30 bg-gradient-to-br from-background via-background to-orange-950/20">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-4 flex-wrap">
              <img
                src={auroraAvatar}
                alt="Aurora — Twoja AI-asystentka"
                width={80} height={80}
                className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover ring-2 ring-orange-500/50 shadow-lg shadow-orange-500/20"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-bold">Twój Dashboard</h1>
                  <Badge variant="outline" className="border-orange-500/40 text-orange-300 gap-1">
                    <Sparkles className="w-3 h-3" /> Aurora czuwa
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Mapa zleceń, dokumenty, kalendarz, notatki i CRM — wszystko pod kontrolą Twojej AI-asystentki.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order picker */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Wybierz zlecenie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {orders.map(o => (
                <button
                  key={o.id}
                  onClick={() => setActiveOrderId(o.id)}
                  className={`shrink-0 text-left p-3 rounded-lg border transition-all min-w-[220px] ${
                    activeOrderId === o.id
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-border hover:border-orange-500/50"
                  }`}
                >
                  <div className="text-xs text-muted-foreground uppercase">{o.service_type}</div>
                  <div className="font-medium truncate text-sm mt-1">{o.brief?.slice(0, 50) ?? "—"}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-[10px]">{o.status}</Badge>
                    <span className="text-[10px] text-muted-foreground">{o.progress_pct ?? 0}%</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 md:grid-cols-7 w-full h-auto">
            <TabsTrigger value="workflow" className="gap-1 text-xs"><Map className="w-3 h-3" />Mapa</TabsTrigger>
            <TabsTrigger value="aurora" className="gap-1 text-xs"><MessageCircle className="w-3 h-3" />Aurora</TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1 text-xs"><FileText className="w-3 h-3" />Faktury</TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1 text-xs"><CalIcon className="w-3 h-3" />Kalendarz</TabsTrigger>
            <TabsTrigger value="notes" className="gap-1 text-xs"><NotebookPen className="w-3 h-3" />Notatki</TabsTrigger>
            <TabsTrigger value="calc" className="gap-1 text-xs"><Calculator className="w-3 h-3" />Kalkulator</TabsTrigger>
            <TabsTrigger value="crm" className="gap-1 text-xs"><Building2 className="w-3 h-3" />CRM</TabsTrigger>
          </TabsList>

          <TabsContent value="workflow">
            {activeOrder && (
              <OrderWorkflowMap
                orderId={activeOrder.id}
                onGeneratePlan={generatePlan}
                generating={generatingPlan}
              />
            )}
          </TabsContent>
          <TabsContent value="aurora">
            {activeOrder && <AuroraNegotiatorPanel orderId={activeOrder.id} />}
          </TabsContent>
          <TabsContent value="invoices">
            {activeOrder && <InvoicesPanel orderId={activeOrder.id} />}
          </TabsContent>
          <TabsContent value="calendar"><CalendarPanel orderId={activeOrderId} /></TabsContent>
          <TabsContent value="notes"><NotesPanel orderId={activeOrderId} /></TabsContent>
          <TabsContent value="calc"><CalculatorPanel /></TabsContent>
          <TabsContent value="crm"><PartnerCRMPanel /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default ClientDashboard;
