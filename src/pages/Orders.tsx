import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Receipt, ExternalLink, Crown, Coffee, Loader2, Calendar, ArrowLeft, Copy, Check } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPaddleEnvironment } from "@/lib/paddle";
import { toast } from "sonner";

type SubTxn = {
  id: string;
  paddle_transaction_id: string;
  paddle_subscription_id: string | null;
  plan: string | null;
  amount: number;
  currency: string;
  status: string;
  billed_at: string;
  invoice_url: string | null;
};

type CoffeeTxn = {
  id: string;
  paddle_transaction_id: string;
  price_id: string;
  amount: number;
  currency: string;
  created_at: string;
  refunded_at: string | null;
};

const fmtMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
};
const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));

const planBadgeColor = (plan: string | null) =>
  plan === "Ultimate"
    ? "bg-accent/15 text-accent border-accent/30"
    : plan === "Pro"
      ? "bg-primary/15 text-primary border-primary/30"
      : "bg-secondary text-muted-foreground border-border";

const Orders = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const env = getPaddleEnvironment();

  const [subs, setSubs] = useState<SubTxn[]>([]);
  const [tips, setTips] = useState<CoffeeTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth?redirect=/orders");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [{ data: subsData }, { data: tipsData }] = await Promise.all([
          supabase
            .from("paddle_transactions")
            .select("id, paddle_transaction_id, paddle_subscription_id, plan, amount, currency, status, billed_at, invoice_url")
            .eq("user_id", user.id)
            .eq("environment", env)
            .order("billed_at", { ascending: false }),
          supabase
            .from("one_time_purchases")
            .select("id, paddle_transaction_id, price_id, amount, currency, created_at, refunded_at")
            .eq("user_id", user.id)
            .eq("environment", env)
            .order("created_at", { ascending: false }),
        ]);
        if (cancelled) return;
        setSubs((subsData as SubTxn[]) || []);
        setTips((tipsData as CoffeeTxn[]) || []);
      } catch (e) {
        console.error(e);
        toast.error("Nie udało się pobrać historii zamówień");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading, env, navigate]);

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
      toast.success("Skopiowano ID");
    } catch {
      toast.error("Nie udało się skopiować");
    }
  };

  const totalSpent = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    subs.forEach((s) => {
      const c = s.currency.toUpperCase();
      byCurrency[c] = (byCurrency[c] || 0) + Number(s.amount);
    });
    tips.forEach((t) => {
      if (t.refunded_at) return;
      const c = t.currency.toUpperCase();
      byCurrency[c] = (byCurrency[c] || 0) + Number(t.amount);
    });
    return Object.entries(byCurrency).map(([c, a]) => fmtMoney(a, c)).join(" · ");
  }, [subs, tips]);

  return (
    <MainLayout>
      <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Wróć do ustawień
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <Receipt className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Historia zamówień</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Wszystkie Twoje płatności w GrouAI Stream — subskrypcje i kawy dla twórców.
          Płatności obsługuje Paddle (Merchant of Record).
        </p>

        {totalSpent && !loading && (
          <div className="mb-6 rounded-xl border border-border bg-secondary/30 p-4">
            <div className="text-xs text-muted-foreground mb-1">Łącznie wsparłeś projekt</div>
            <div className="text-xl font-display font-bold groove-gradient-text">{totalSpent}</div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* SUBSCRIPTIONS */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Crown className="h-4 w-4 text-accent" />
                <h2 className="font-display font-semibold text-lg">Subskrypcje</h2>
                <Badge variant="outline" className="ml-1">{subs.length}</Badge>
              </div>

              {subs.length === 0 ? (
                <EmptyHint
                  title="Brak płatności za subskrypcję"
                  hint="Po zakupie planu Pro lub Ultimate Twoje rachunki pojawią się tutaj — z linkiem do faktury PDF i ID transakcji do księgowości."
                />
              ) : (
                <div className="space-y-3">
                  {subs.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-xl border border-border bg-card p-4 sm:p-5 hover:border-primary/40 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <Badge className={planBadgeColor(s.plan)}>
                              GrouAI Stream {s.plan || "—"}
                            </Badge>
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {fmtDate(s.billed_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono truncate max-w-[260px] sm:max-w-md" title={s.paddle_transaction_id}>
                              {s.paddle_transaction_id}
                            </span>
                            <button
                              onClick={() => copyId(s.paddle_transaction_id)}
                              className="p-1 rounded hover:bg-secondary transition flex-shrink-0"
                              aria-label="Kopiuj ID"
                            >
                              {copiedId === s.paddle_transaction_id ? (
                                <Check className="h-3 w-3 text-green-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                          <div className="text-right">
                            <div className="text-xl font-bold font-display">{fmtMoney(Number(s.amount), s.currency)}</div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {s.status === "completed" ? "Opłacone" : s.status}
                            </div>
                          </div>
                          {s.invoice_url && (
                            <Button asChild size="sm" variant="outline" className="gap-1.5">
                              <a href={s.invoice_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                                Faktura PDF
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>

            {/* COFFEE TIPS */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Coffee className="h-4 w-4 text-amber-400" />
                <h2 className="font-display font-semibold text-lg">Kawy dla twórców</h2>
                <Badge variant="outline" className="ml-1">{tips.length}</Badge>
              </div>

              {tips.length === 0 ? (
                <EmptyHint
                  title="Jeszcze żadnej kawy"
                  hint="Postaw kawę twórcy, którego utwór dziś gra — 90% trafia prosto do niego."
                />
              ) : (
                <div className="space-y-3">
                  {tips.map((t, i) => {
                    const emoji =
                      t.price_id === "grouai_coffee_irish" ? "☕🥃" :
                      t.price_id === "grouai_coffee_latte" ? "☕🥛" : "☕";
                    return (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="rounded-xl border border-border bg-card p-4 sm:p-5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{emoji}</span>
                              <span className="font-semibold">Kawa dla twórcy</span>
                              {t.refunded_at && (
                                <Badge variant="outline" className="text-destructive border-destructive/40">
                                  Zwrócono
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {fmtDate(t.created_at)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                              <span className="font-mono truncate max-w-[260px]" title={t.paddle_transaction_id}>
                                {t.paddle_transaction_id}
                              </span>
                              <button
                                onClick={() => copyId(t.paddle_transaction_id)}
                                className="p-1 rounded hover:bg-secondary transition"
                                aria-label="Kopiuj ID"
                              >
                                {copiedId === t.paddle_transaction_id ? (
                                  <Check className="h-3 w-3 text-green-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-xl font-bold font-display ${t.refunded_at ? "line-through text-muted-foreground" : ""}`}>
                              {fmtMoney(Number(t.amount), t.currency)}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>

            <p className="text-xs text-muted-foreground text-center pt-4">
              Faktury VAT dostępne są również w panelu klienta Paddle. Pytania? <a className="underline" href="mailto:kontakt@grouaistream.com">kontakt@grouaistream.com</a>
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

const EmptyHint = ({ title, hint }: { title: string; hint: string }) => (
  <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center">
    <p className="font-semibold mb-1">{title}</p>
    <p className="text-xs text-muted-foreground max-w-md mx-auto">{hint}</p>
  </div>
);

export default Orders;
