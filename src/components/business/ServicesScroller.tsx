import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Service = {
  key: string;
  name: string;
  desc: string;
  price: string;
  bullets: string[];
  icon: any;
};

interface Props {
  services: Service[];
  onPick: (key: string, name: string) => void;
}

export function ServicesScroller({ services, onPick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ down: boolean; startX: number; startY: number; startScroll: number; moved: boolean }>({
    down: false,
    startX: 0,
    startY: 0,
    startScroll: 0,
    moved: false,
  });
  const [pending, setPending] = useState<Service | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Vertical mouse wheel → horizontal scroll
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if ((e.deltaY > 0 && el.scrollLeft < max) || (e.deltaY < 0 && el.scrollLeft > 0)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel as any);
  }, []);

  // Track which card is centered
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-card]"));
      const center = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      cards.forEach((c, i) => {
        const cc = c.offsetLeft + c.offsetWidth / 2;
        const d = Math.abs(cc - center);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      setActiveIdx(best);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
  }, [services.length]);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ down: true, startX: e.clientX, startY: e.clientY, startScroll: el.scrollLeft, moved: false });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.down) return;
    const el = ref.current;
    if (!el) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) setDrag((d) => ({ ...d, moved: true }));
    if (Math.abs(dx) > Math.abs(dy)) {
      el.scrollLeft = drag.startScroll - dx;
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.down) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    // Vertical swipe gesture for confirmation
    if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx) * 1.4) {
      if (dy < 0) {
        // swipe up = pick centered card
        const s = services[activeIdx];
        if (s) setPending(s);
      } else {
        // swipe down = close pending
        setPending(null);
      }
    }
    setDrag((d) => ({ ...d, down: false }));
  };

  const scrollBy = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 20 : 320;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-0 top-0 bottom-4 w-12 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-background to-transparent z-10" />

      <button
        aria-label="Przewiń w lewo"
        onClick={() => scrollBy(-1)}
        className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-card/80 border border-cyan-400/40 backdrop-blur shadow-[0_0_20px_hsl(190_100%_50%/0.3)] hover:bg-cyan-400/20 transition"
      >
        <ChevronLeft className="h-5 w-5 text-cyan-200" />
      </button>
      <button
        aria-label="Przewiń w prawo"
        onClick={() => scrollBy(1)}
        className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-card/80 border border-cyan-400/40 backdrop-blur shadow-[0_0_20px_hsl(190_100%_50%/0.3)] hover:bg-cyan-400/20 transition"
      >
        <ChevronRight className="h-5 w-5 text-cyan-200" />
      </button>

      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`flex gap-4 sm:gap-5 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth pb-6 px-2 [scrollbar-width:thin] ${
          drag.down ? "cursor-grabbing select-none" : "cursor-grab"
        }`}
        style={{ scrollbarColor: "hsl(190 100% 50% / 0.4) transparent", touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" }}
      >
        {services.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.key}
              data-card
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: Math.min(i, 6) * 0.04 }}
              className="group relative flex-shrink-0 snap-center w-[88%] sm:w-[360px]"
            >
              <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-cyan-400/40 via-blue-500/20 to-purple-500/30 opacity-60 group-hover:opacity-100 transition-opacity blur-[2px] group-hover:blur-[6px]" />
              <Card className="relative h-full rounded-2xl border-0 bg-gradient-to-br from-card/95 via-card/85 to-card/70 backdrop-blur-xl shadow-[0_10px_40px_-10px_hsl(210_100%_30%/0.4),0_0_0_1px_hsl(190_100%_50%/0.15)] transition-all duration-500 overflow-hidden">
                <div className="absolute top-0 right-0 h-32 w-32 bg-cyan-400/10 blur-3xl rounded-full" />
                <div className="absolute bottom-0 left-0 h-24 w-24 bg-blue-500/10 blur-3xl rounded-full" />
                <CardContent className="relative p-5 sm:p-6 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-cyan-400/40 blur-xl rounded-xl" />
                      <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border border-cyan-400/50 flex items-center justify-center shadow-[inset_0_1px_0_hsl(190_100%_70%/0.3)]">
                        <Icon className="h-5 w-5 text-cyan-200 drop-shadow-[0_0_8px_hsl(190_100%_50%/0.8)]" />
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-gradient-to-r from-cyan-400/20 to-blue-500/20 text-cyan-200 border border-cyan-400/40 shadow-[0_0_15px_hsl(190_100%_50%/0.3)]">
                      {s.price}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 bg-gradient-to-r from-foreground to-cyan-100 bg-clip-text text-transparent">{s.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{s.desc}</p>
                  <ul className="space-y-1.5 text-xs text-muted-foreground mb-5 flex-1">
                    {s.bullets.map((b, j) => (
                      <li key={j} className="flex gap-2">
                        <Check className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0 mt-0.5 drop-shadow-[0_0_4px_hsl(190_100%_50%/0.8)]" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={(e) => {
                      if (drag.moved) {
                        e.preventDefault();
                        return;
                      }
                      setPending(s);
                    }}
                    className="w-full h-11 bg-gradient-to-r from-cyan-500/90 to-blue-600/90 hover:from-cyan-400 hover:to-blue-500 text-white border-0 shadow-[0_4px_20px_-4px_hsl(190_100%_50%/0.5)] hover:shadow-[0_8px_30px_-4px_hsl(190_100%_50%/0.7)] transition-all"
                  >
                    Zacznij rozmowę <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination dots + swipe hint (mobile) */}
      <div className="flex flex-col items-center gap-2 mt-1 md:hidden">
        <div className="flex items-center gap-1.5">
          {services.map((_, i) => (
            <button
              key={i}
              aria-label={`Karta ${i + 1}`}
              onClick={() => {
                const el = ref.current;
                const card = el?.querySelectorAll<HTMLElement>("[data-card]")[i];
                if (el && card) el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: "smooth" });
              }}
              className={`h-1.5 rounded-full transition-all ${i === activeIdx ? "w-6 bg-cyan-400" : "w-1.5 bg-cyan-400/30"}`}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/70">← przesuń → · ↑ wybierz · ↓ anuluj</p>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Potwierdź wybór</AlertDialogTitle>
            <AlertDialogDescription>
              Chcesz rozpocząć rozmowę z Aurorą o usłudze <span className="font-semibold text-cyan-300">{pending?.name}</span> ({pending?.price})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="gap-1"><X className="h-4 w-4" /> Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) onPick(pending.key, pending.name);
                setPending(null);
              }}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white gap-1"
            >
              <Check className="h-4 w-4" /> Tak, rozpocznij
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
