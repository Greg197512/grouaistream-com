// Excel-lite — mini arkusz z formułami SUM/AVG/MIN/MAX i eksportem .xlsx
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Plus, Minus, FileSpreadsheet, Save, RotateCcw } from "lucide-react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const STORAGE_KEY = "groua-excel-lite-data";
const ROWS = 20;
const COLS = 8;

const colLetter = (i: number) => String.fromCharCode(65 + i);

// Prosta ewaluacja formuł: =SUM(A1:A5), =AVG(B1:B3), =MIN, =MAX, =A1+B1*2
function parseRange(ref: string, data: string[][]): number[] {
  const m = ref.match(/^([A-Z])(\d+):([A-Z])(\d+)$/);
  if (m) {
    const c1 = m[1].charCodeAt(0) - 65, r1 = parseInt(m[2]) - 1;
    const c2 = m[3].charCodeAt(0) - 65, r2 = parseInt(m[4]) - 1;
    const out: number[] = [];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const v = parseFloat(data[r]?.[c] ?? "");
        if (!isNaN(v)) out.push(v);
      }
    }
    return out;
  }
  // Single cell
  const single = ref.match(/^([A-Z])(\d+)$/);
  if (single) {
    const c = single[1].charCodeAt(0) - 65, r = parseInt(single[2]) - 1;
    const v = parseFloat(data[r]?.[c] ?? "");
    return isNaN(v) ? [] : [v];
  }
  return [];
}

function evaluateFormula(formula: string, data: string[][]): string {
  try {
    const f = formula.slice(1).trim().toUpperCase();
    // SUM/AVG/MIN/MAX/COUNT
    const fn = f.match(/^(SUM|AVG|AVERAGE|MIN|MAX|COUNT)\((.+)\)$/);
    if (fn) {
      const [, name, args] = fn;
      const nums = args.split(",").flatMap(a => parseRange(a.trim(), data));
      if (!nums.length) return "0";
      switch (name) {
        case "SUM": return String(nums.reduce((a, b) => a + b, 0));
        case "AVG":
        case "AVERAGE": return String((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
        case "MIN": return String(Math.min(...nums));
        case "MAX": return String(Math.max(...nums));
        case "COUNT": return String(nums.length);
      }
    }
    // Prosta arytmetyka z odwołaniami: A1+B2*2
    const expr = f.replace(/[A-Z]\d+/g, (ref) => {
      const v = parseRange(ref, data);
      return String(v[0] ?? 0);
    });
    if (/^[\d+\-*/.()\s]+$/.test(expr)) {
      // eslint-disable-next-line no-new-func
      const r = Function(`"use strict";return (${expr})`)();
      return String(typeof r === "number" ? Math.round(r * 1000000) / 1000000 : r);
    }
    return "#ERR";
  } catch {
    return "#ERR";
  }
}

const emptyData = (): string[][] => Array.from({ length: ROWS }, () => Array(COLS).fill(""));

const seedData = (): string[][] => {
  const d = emptyData();
  d[0] = ["Pozycja", "Cena", "Ilość", "Suma", "", "Statystyki", "Wartość", ""];
  d[1] = ["Konsultacja Aurora", "10", "1", "=B2*C2", "", "Suma kosztów:", "=SUM(D2:D5)", ""];
  d[2] = ["Pakiet B2B", "400", "1", "=B3*C3", "", "Średnia ceny:", "=AVG(B2:B5)", ""];
  d[3] = ["Negocjator AI", "150", "2", "=B4*C4", "", "Najwyższa:", "=MAX(B2:B5)", ""];
  d[4] = ["Workflow custom", "250", "1", "=B5*C5", "", "Liczba pozycji:", "=COUNT(B2:B5)", ""];
  return d;
};

export const ExcelLitePanel = () => {
  const [data, setData] = useState<string[][]>(() => {
    if (typeof window === "undefined") return seedData();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : seedData();
    } catch { return seedData(); }
  });
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Auto-save
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [data]);

  const display = useMemo(() => {
    return data.map(row => row.map(cell => {
      if (typeof cell === "string" && cell.startsWith("=")) return evaluateFormula(cell, data);
      return cell;
    }));
  }, [data]);

  const startEdit = (r: number, c: number) => {
    setEditing({ r, c });
    setEditValue(data[r][c]);
  };

  const commitEdit = () => {
    if (!editing) return;
    setData(prev => {
      const next = prev.map(row => [...row]);
      next[editing.r][editing.c] = editValue;
      return next;
    });
    setEditing(null);
  };

  const exportXlsx = () => {
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Arkusz1");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `arkusz-${Date.now()}.xlsx`);
    toast.success("Eksport .xlsx gotowy");
  };

  const exportCsv = () => {
    const ws = XLSX.utils.aoa_to_sheet(display);
    const csv = XLSX.utils.sheet_to_csv(ws);
    saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), `arkusz-${Date.now()}.csv`);
  };

  const reset = () => {
    if (confirm("Zresetować arkusz do przykładu?")) setData(seedData());
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">📊 Excel-lite</CardTitle>
            <CardDescription>
              Mini-arkusz z formułami: <code className="text-[10px] bg-muted px-1 rounded">=SUM(A1:A5)</code>{" "}
              <code className="text-[10px] bg-muted px-1 rounded">=AVG</code>{" "}
              <code className="text-[10px] bg-muted px-1 rounded">=MIN/MAX</code>{" "}
              <code className="text-[10px] bg-muted px-1 rounded">=A1*B1+10</code>
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset} className="gap-1"><RotateCcw className="w-3 h-3" />Reset</Button>
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1"><Download className="w-3 h-3" />.csv</Button>
            <Button size="sm" onClick={exportXlsx} className="gap-1"><FileSpreadsheet className="w-3 h-3" />Eksportuj .xlsx</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto border rounded-lg">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/60">
                <th className="w-8 border px-1 py-1 text-[10px] text-muted-foreground sticky left-0 bg-muted/60">#</th>
                {Array.from({ length: COLS }, (_, i) => (
                  <th key={i} className="border px-2 py-1 text-[11px] font-mono text-muted-foreground min-w-[100px]">
                    {colLetter(i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, r) => (
                <tr key={r}>
                  <td className="w-8 border px-1 py-1 text-[10px] text-muted-foreground bg-muted/40 text-center sticky left-0">{r + 1}</td>
                  {row.map((cell, c) => {
                    const isEditing = editing?.r === r && editing?.c === c;
                    const shown = display[r][c];
                    const isFormula = typeof cell === "string" && cell.startsWith("=");
                    return (
                      <td
                        key={c}
                        className={`border p-0 ${isFormula ? "bg-emerald-500/5" : ""} ${shown === "#ERR" ? "bg-red-500/10 text-red-400" : ""}`}
                        onDoubleClick={() => startEdit(r, c)}
                      >
                        {isEditing ? (
                          <Input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              if (e.key === "Escape") setEditing(null);
                            }}
                            className="h-7 text-xs border-0 rounded-none focus-visible:ring-1 focus-visible:ring-primary"
                          />
                        ) : (
                          <div
                            className="px-2 py-1 cursor-cell min-h-[28px] truncate"
                            title={isFormula ? cell : undefined}
                            onClick={() => startEdit(r, c)}
                          >
                            {shown}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          💡 <strong>Klik 2x</strong> żeby edytować • Formuły zaczynają się od <code>=</code> • Zielone tło = formuła • Auto-zapis lokalny
        </p>
      </CardContent>
    </Card>
  );
};
