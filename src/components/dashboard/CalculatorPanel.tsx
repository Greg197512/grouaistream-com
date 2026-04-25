// Profesjonalny kalkulator biznesowy: VAT, marża, ROI, czysta arytmetyka
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator } from "lucide-react";

const num = (v: string) => Number(v.replace(",", ".")) || 0;

export const CalculatorPanel = () => {
  // Basic
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("");
  const calc = () => {
    try {
      // bezpieczna ewaluacja: tylko cyfry, operatory, kropki, nawiasy
      if (!/^[\d+\-*/().,\s]+$/.test(expr)) throw new Error("Niedozwolone znaki");
      const r = Function(`"use strict";return (${expr.replace(/,/g, ".")})`)();
      setResult(String(r));
    } catch (e: any) { setResult("Błąd: " + e.message); }
  };

  // VAT
  const [netVat, setNetVat] = useState(""); const [vatRate, setVatRate] = useState("23");
  const vatAmount = (num(netVat) * num(vatRate)) / 100;
  const grossVat = num(netVat) + vatAmount;

  // Marża
  const [cost, setCost] = useState(""); const [price, setPrice] = useState("");
  const margin = num(price) > 0 ? (((num(price) - num(cost)) / num(price)) * 100) : 0;
  const markup = num(cost) > 0 ? (((num(price) - num(cost)) / num(cost)) * 100) : 0;

  // ROI
  const [invest, setInvest] = useState(""); const [revenue, setRevenue] = useState("");
  const roi = num(invest) > 0 ? (((num(revenue) - num(invest)) / num(invest)) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Calculator className="w-5 h-5" />Kalkulator biznesowy</CardTitle>
        <CardDescription>VAT, marża, ROI i wyrażenia</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="basic">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="basic">Podstawowy</TabsTrigger>
            <TabsTrigger value="vat">VAT</TabsTrigger>
            <TabsTrigger value="margin">Marża</TabsTrigger>
            <TabsTrigger value="roi">ROI</TabsTrigger>
          </TabsList>
          <TabsContent value="basic" className="space-y-2 pt-3">
            <Input value={expr} onChange={e => setExpr(e.target.value)} placeholder="np. (1200 + 350) * 1.23" onKeyDown={e => e.key === "Enter" && calc()} />
            <button onClick={calc} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm">Oblicz</button>
            <div className="text-2xl font-bold text-orange-400 pt-2">{result || "—"}</div>
          </TabsContent>
          <TabsContent value="vat" className="space-y-2 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Kwota netto</Label><Input value={netVat} onChange={e => setNetVat(e.target.value)} /></div>
              <div><Label>Stawka VAT %</Label><Input value={vatRate} onChange={e => setVatRate(e.target.value)} /></div>
            </div>
            <div className="text-sm space-y-1 pt-2">
              <div>VAT: <strong>{vatAmount.toFixed(2)}</strong></div>
              <div className="text-lg">Brutto: <strong className="text-orange-400">{grossVat.toFixed(2)}</strong></div>
            </div>
          </TabsContent>
          <TabsContent value="margin" className="space-y-2 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Koszt</Label><Input value={cost} onChange={e => setCost(e.target.value)} /></div>
              <div><Label>Cena sprzedaży</Label><Input value={price} onChange={e => setPrice(e.target.value)} /></div>
            </div>
            <div className="text-sm space-y-1 pt-2">
              <div>Marża: <strong className="text-orange-400">{margin.toFixed(2)}%</strong></div>
              <div>Narzut: <strong>{markup.toFixed(2)}%</strong></div>
              <div>Zysk: <strong>{(num(price) - num(cost)).toFixed(2)}</strong></div>
            </div>
          </TabsContent>
          <TabsContent value="roi" className="space-y-2 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Inwestycja</Label><Input value={invest} onChange={e => setInvest(e.target.value)} /></div>
              <div><Label>Przychód</Label><Input value={revenue} onChange={e => setRevenue(e.target.value)} /></div>
            </div>
            <div className="text-2xl font-bold text-orange-400 pt-2">ROI: {roi.toFixed(2)}%</div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
