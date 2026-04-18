import { ReactNode, useMemo } from "react";

interface BurningFrameProps {
  children: ReactNode;
  className?: string;
}

/**
 * BurningFrame – delikatnie płonąca ramka w odcieniach pomarańczu
 * z unoszącymi się iskierkami / drobinkami popiołu.
 * Wszystkie kolory bazują na tokenach designu (--primary / --accent),
 * więc działa spójnie z neonowo-pomarańczową paletą GrouAI.
 */
export const BurningFrame = ({ children, className = "" }: BurningFrameProps) => {
  // Generujemy stabilny zestaw iskierek (różne pozycje, opóźnienia, czasy)
  const sparks = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 1 + Math.random() * 3,
        delay: Math.random() * 6,
        duration: 4 + Math.random() * 5,
        drift: (Math.random() - 0.5) * 60,
        hue: Math.random() > 0.5 ? "hsl(24 100% 60%)" : "hsl(38 100% 65%)",
      })),
    []
  );

  return (
    <div className={`burning-frame relative ${className}`}>
      {/* Zewnętrzna poświata (oddech ognia) */}
      <div className="burning-frame__glow pointer-events-none absolute -inset-1 rounded-2xl" />

      {/* Animowana ramka z gradientem ognia */}
      <div className="burning-frame__border relative rounded-2xl p-[2px]">
        <div className="relative rounded-2xl bg-background/95 backdrop-blur-sm overflow-hidden">
          {/* Wewnętrzna delikatna mgiełka ciepła na górze i dole */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-primary/10 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-accent/10 to-transparent" />

          {/* Iskierki / drobinki unoszące się od dołu do góry */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {sparks.map((s) => (
              <span
                key={s.id}
                className="burning-spark absolute rounded-full"
                style={{
                  left: `${s.left}%`,
                  width: `${s.size}px`,
                  height: `${s.size}px`,
                  background: s.hue,
                  boxShadow: `0 0 ${s.size * 4}px ${s.hue}`,
                  animationDelay: `${s.delay}s`,
                  animationDuration: `${s.duration}s`,
                  ["--drift" as string]: `${s.drift}px`,
                }}
              />
            ))}
          </div>

          {/* Treść */}
          <div className="relative z-10 p-6 md:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
};
