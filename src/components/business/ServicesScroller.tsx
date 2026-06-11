import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, ChevronLeft, ChevronRight } from "lucide-react";

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
  const [drag, setDrag] = useState<{ down: boolean; startX: number; startScroll: number; moved: boolean }>({
    down: false,
    startX: 0,
    startScroll: 0,
    moved: false,
  });

  // Vertical mouse wheel → horizontal scroll
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      // only hijack if we can actually scroll horizontally in that direction
      if ((e.deltaY > 0 && el.scrollLeft < max) || (e.deltaY < 0 && el.scrollLeft > 0)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel as any);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ down: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.down) return;
    const el = ref.current;
    if (!el) return;
    const dx = e.clientX - drag.startX;
    if (Math.abs(dx) > 4) setDrag((d) => ({ ...d, moved: true }));
    el.scrollLeft = drag.startScroll - dx;
  };
  const onPointerUp = () => setDrag((d) => ({ ...d, down: false }));

  const scrollBy = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 20 : 320;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* edge fades */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-4 w-12 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-background to-transparent z-10" />

      {/* arrows */}
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
        onPointerLeave={onPointerUp}
        className={`flex gap-5 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth pb-6 px-2 [scrollbar-width:thin] ${
          drag.down ? "cursor-grabbing select-none" : "cursor-grab"
        }`}
        style={{ scrollbarColor: "hsl(190 100% 50% / 0.4) transparent" }}
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
              whileHover={{ y: -8, rotateX: 4, rotateY: -4 }}
              className="group relative flex-shrink-0 snap-center w-[85%] sm:w-[360px] [transform-style:preserve-3d]"
            >
              <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-cyan-400/40 via-blue-500/20 to-purple-500/30 opacity-60 group-hover:opacity-100 transition-opacity blur-[2px] group-hover:blur-[6px] animate-pulse" />
              <Card className="relative h-full rounded-2xl border-0 bg-gradient-to-br from-card/95 via-card/85 to-card/70 backdrop-blur-xl shadow-[0_10px_40px_-10px_hsl(210_100%_30%/0.4),0_0_0_1px_hsl(190_100%_50%/0.15)] group-hover:shadow-[0_25px_70px_-10px_hsl(190_100%_50%/0.55),0_0_0_1px_hsl(190_100%_50%/0.5)] transition-all duration-500 overflow-hidden">
                <div className="absolute top-0 right-0 h-32 w-32 bg-cyan-400/10 blur-3xl rounded-full" />
                <div className="absolute bottom-0 left-0 h-24 w-24 bg-blue-500/10 blur-3xl rounded-full" />
                <CardContent className="relative p-6 flex flex-col h-full">
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
                      onPick(s.key, s.name);
                    }}
                    className="w-full bg-gradient-to-r from-cyan-500/90 to-blue-600/90 hover:from-cyan-400 hover:to-blue-500 text-white border-0 shadow-[0_4px_20px_-4px_hsl(190_100%_50%/0.5)] hover:shadow-[0_8px_30px_-4px_hsl(190_100%_50%/0.7)] transition-all"
                  >
                    Zacznij rozmowę <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
