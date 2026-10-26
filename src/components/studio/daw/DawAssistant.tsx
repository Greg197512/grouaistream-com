// Okienko asystenta DAW: polecenia zwykłymi słowami + podpowiedzi zależne od tego, co się dzieje.
import { useState } from "react";
import { Bot, Lightbulb, Loader2, Send, X } from "lucide-react";
import { DAW_EXAMPLES, tipsFor, type DawState } from "@/lib/daw/assistant";

type Msg = { role: "user" | "assistant"; text: string };

export function DawAssistant({ state, onCommand }: { state: DawState; onCommand: (text: string) => Promise<string> }) {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const tip = tipsFor(state).find((t) => !dismissed.includes(t.id));

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setBusy(true);
    try {
      const reply = await onCommand(t);
      setMsgs((m) => [...m, { role: "assistant", text: reply }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-white/10 bg-[#11111a]">
      {tip && (
        <div className="flex items-start gap-2 border-b border-white/10 bg-[#FFD400]/[0.06] px-3 py-2 text-xs text-[#FFE680]" role="status">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{tip.text}</span>
          <button type="button" onClick={() => setDismissed((d) => [...d, tip.id])} aria-label="Ukryj podpowiedź" className="text-[#FFE680]/70 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-white hover:bg-white/5" aria-expanded={open}>
        <Bot className="h-4 w-4 text-[#22d3ee]" /> Asystent studia — opisz, co chcesz zrobić
        <span className="ml-auto text-gray-500">{open ? "zwiń" : "rozwiń"}</span>
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          {msgs.length > 0 && (
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg bg-black/30 p-2 text-xs" aria-live="polite">
              {msgs.map((m, i) => (
                <p key={i} className={m.role === "user" ? "text-right text-gray-300" : "text-[#9be8f5]"}>
                  {m.role === "assistant" && <Bot className="mr-1 inline h-3 w-3" />}{m.text}
                </p>
              ))}
            </div>
          )}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
            <input
              value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="np. głos cieplejszy i więcej pogłosu · dodaj perkusję hip-hop · autotune w A-moll"
              className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-gray-600"
              aria-label="Polecenie dla asystenta"
            />
            <button type="submit" disabled={busy || !input.trim()} className="inline-flex items-center gap-1 rounded-lg bg-[#22d3ee]/20 px-3 text-xs font-semibold text-[#9be8f5] disabled:opacity-40">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Zrób
            </button>
          </form>
          <div className="flex flex-wrap gap-1">
            {DAW_EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => void send(ex)} disabled={busy} className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-gray-400 hover:border-[#22d3ee]/50 hover:text-white">
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
