// CRM firm partnerskich B2B
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Plus, Search } from "lucide-react";

interface Company {
  id: string; company_name: string; industry: string | null; city: string | null;
  primary_email: string | null; partnership_status: string; partnership_value_eur: number;
  tax_id: string | null; website: string | null;
}

const statusColor = (s: string) => {
  if (s === "active") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (s === "negotiating") return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  if (s === "blacklist") return "bg-red-500/20 text-red-300 border-red-500/40";
  return "bg-muted";
};

export const PartnerCRMPanel = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("aurora_partner_companies")
      .select("id, company_name, industry, city, primary_email, partnership_status, partnership_value_eur, tax_id, website")
      .order("partnership_value_eur", { ascending: false }).limit(200);
    setCompanies((data ?? []) as Company[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = companies.filter(c =>
    !search || c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.industry?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" />CRM Firm Partnerskich</CardTitle>
            <CardDescription>Baza firm B2B do współpracy</CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-3 h-3 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj…" className="pl-7 w-48" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> :
          filtered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Brak firm w bazie. Aurora zacznie ją zapełniać przy kolejnych zleceniach.</p> :
          <div className="space-y-2 max-h-[600px] overflow-auto">
            {filtered.map(c => (
              <div key={c.id} className="p-3 border rounded-lg flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{c.company_name}</span>
                    <Badge className={statusColor(c.partnership_status) + " text-[10px]"}>{c.partnership_status}</Badge>
                    {c.industry && <Badge variant="outline" className="text-[10px]">{c.industry}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {[c.city, c.primary_email, c.tax_id && `NIP: ${c.tax_id}`].filter(Boolean).join(" • ")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-orange-400">{Number(c.partnership_value_eur).toLocaleString("pl-PL")} €</div>
                  {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline">www</a>}
                </div>
              </div>
            ))}
          </div>
        }
      </CardContent>
    </Card>
  );
};
