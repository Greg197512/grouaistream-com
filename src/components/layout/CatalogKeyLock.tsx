import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, LockOpen, KeyRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCatalogUnlock, CATALOG_ACCESS_CODE } from "@/hooks/useCatalogUnlock";

/**
 * Kłódka katalogu w górnym pasku.
 * - Zamknięta (czerwona) = katalog ograniczony. Klik → okienko na kod.
 * - Poprawny kod → odblokowuje pełny katalog (~20 tys.), kłódka otwarta (zielona).
 * - Klik w otwartą kłódkę → zamyka dostęp, znów świeci na czerwono.
 * Klucz dajesz tylko wybranym.
 */
export const CatalogKeyLock = () => {
  const { unlocked, unlock, lock } = useCatalogUnlock();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const handleClick = () => {
    if (unlocked) {
      // Otwarta kłódka → zamknij dostęp (świeci na czerwono).
      lock();
      toast("🔒 Katalog zamknięty — pełny dostęp wyłączony");
      return;
    }
    setOpen((v) => !v);
  };

  const tryUnlock = (value: string) => {
    if (unlock(value)) {
      setOpen(false);
      setCode("");
      setError(false);
      toast.success("🔓 Odblokowano pełny katalog — wszystkie utwory widoczne");
    } else {
      setError(true);
      setCode("");
      toast.error("Błędny klucz");
    }
  };

  return (
    <Popover open={open && !unlocked} onOpenChange={(o) => { setOpen(o); if (!o) { setCode(""); setError(false); } }}>
      <PopoverTrigger asChild>
        <motion.button
          type="button"
          onClick={handleClick}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          title={unlocked ? "Katalog odblokowany — kliknij, aby zamknąć" : "Katalog zablokowany — kliknij, aby wpisać klucz"}
          aria-label={unlocked ? "Zamknij dostęp do katalogu" : "Odblokuj katalog kodem"}
          className={cn(
            "relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border transition-colors",
            unlocked
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.45)]"
              : "border-red-500/50 bg-red-500/15 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.45)] animate-pulse"
          )}
        >
          {unlocked ? <LockOpen className="h-4 w-4 sm:h-5 sm:w-5" /> : <Lock className="h-4 w-4 sm:h-5 sm:w-5" />}
        </motion.button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-4">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Klucz do katalogu</h4>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Wpisz kod, aby odblokować pełny katalog (~20 tys. utworów).
        </p>

        <motion.div animate={error ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>
          <InputOTP
            maxLength={CATALOG_ACCESS_CODE.length}
            value={code}
            onChange={(v) => {
              setError(false);
              setCode(v);
              if (v.length === CATALOG_ACCESS_CODE.length) tryUnlock(v);
            }}
          >
            <InputOTPGroup className="mx-auto">
              {Array.from({ length: CATALOG_ACCESS_CODE.length }).map((_, i) => (
                <InputOTPSlot key={i} index={i} className={error ? "border-red-500" : undefined} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </motion.div>

        {error && <p className="text-[11px] text-red-400 mt-2 text-center">Błędny klucz — spróbuj ponownie.</p>}

        <Button
          size="sm"
          className="w-full mt-3 gap-2"
          disabled={code.length !== CATALOG_ACCESS_CODE.length}
          onClick={() => tryUnlock(code)}
        >
          <LockOpen className="h-4 w-4" />
          Odblokuj
        </Button>
      </PopoverContent>
    </Popover>
  );
};
