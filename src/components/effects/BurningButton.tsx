import { ReactNode, useMemo } from "react";

interface BurningButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * BurningButton – pełnowymiarowy, mocno płonący przycisk z gęstym deszczem iskier
 * unoszących się wokół całej ramki. Spójny z paletą GrouAI (orange/amber tokens).
 */
export const BurningButton = ({
  children,
  onClick,
  className = "",
  ariaLabel,
}: BurningButtonProps) => {
  // Gęsty zestaw iskier rozsianych wokół ramki (góra, dół, boki)
  const sparks = useMemo(
    () =>
      Array.from({ length: 60 }).map((_, i) => ({
        id: i,
        left: Math.random() * 110 - 5, // -5%..105% – także po bokach
        size: 1 + Math.random() * 3.5,
        delay: Math.random() * 5,
        duration: 3 + Math.random() * 5,
        drift: (Math.random() - 0.5) * 90,
        hue:
          Math.random() > 0.6
            ? "hsl(38 100% 65%)"
            : Math.random() > 0.4
            ? "hsl(24 100% 60%)"
            : "hsl(14 100% 57%)",
      })),
    []
  );

  return (
    <div className={`burning-btn-wrap relative ${className}`}>
      {/* Iskry unoszące się wokół całego przycisku */}
      <div
        className="pointer-events-none absolute -inset-6 overflow-visible"
        aria-hidden="true"
      >
        {sparks.map((s) => (
          <span
            key={s.id}
            className="burning-spark absolute rounded-full"
            style={{
              left: `${s.left}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              background: s.hue,
              boxShadow: `0 0 ${s.size * 5}px ${s.hue}`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
              ["--drift" as string]: `${s.drift}px`,
            }}
          />
        ))}
      </div>

      {/* Poświata / oddech ognia */}
      <div className="burning-frame__glow pointer-events-none absolute -inset-2 rounded-2xl" />

      {/* Sam przycisk */}
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="burning-frame__border relative w-full rounded-2xl p-[2px] cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]"
      >
        <span className="relative flex items-center justify-center w-full rounded-2xl bg-background/90 backdrop-blur-sm overflow-hidden px-6 py-5 md:py-6">
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15" />
          <span className="relative z-10 text-center font-bold text-base md:text-xl text-foreground tracking-tight">
            {children}
          </span>
        </span>
      </button>
    </div>
  );
};
