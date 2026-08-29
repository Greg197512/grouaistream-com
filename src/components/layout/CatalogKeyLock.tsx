import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, LockOpen, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCatalogUnlock, CATALOG_ACCESS_CODE } from "@/hooks/useCatalogUnlock";

/**
 * Kłódka w górnym pasku. Czerwona = zamknięta, zielona = otwarta.
 * Klik (zamknięta) → wpisujesz klucz. Klik (otwarta) → zamyka dostęp.
 * Bez opisów — sama kłódka. Panel renderowany w portalu (nie klipuje się).
 */
export const CatalogKeyLock = () => {
  const { unlocked, unlock, lock } = useCatalogUnlock();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const onScroll = () => place();
    const onDown = (e: MouseEvent) => {
      const tgt = e.target as Node;
      if (panelRef.current?.contains(tgt) || btnRef.current?.contains(tgt)) return;
      setOpen(false);
    };
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("mousedown", onDown);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const handleClick = () => {
    if (unlocked) {
      lock();
      setOpen(false);
      toast("🔒");
      return;
    }
    setError(false);
    setOpen((v) => !v);
  };

  const tryUnlock = (value: string) => {
    if (unlock(value)) {
      setOpen(false);
      setCode("");
      setError(false);
      toast.success("🔓");
    } else {
      setError(true);
      setCode("");
      inputRef.current?.focus();
    }
  };

  return (
    <>
      <motion.button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label={unlocked ? "Zamknij" : "Klucz"}
        className={cn(
          "relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border transition-colors",
          unlocked
            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.45)]"
            : "border-red-500/50 bg-red-500/15 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.45)] animate-pulse"
        )}
      >
        {unlocked ? <LockOpen className="h-4 w-4 sm:h-5 sm:w-5" /> : <Lock className="h-4 w-4 sm:h-5 sm:w-5" />}
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {open && !unlocked && pos && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
              className="w-52 rounded-xl border border-border bg-popover p-3 shadow-2xl"
            >
              <div className="flex justify-center mb-2 text-primary">
                <KeyRound className="h-5 w-5" />
              </div>
              <motion.div animate={error ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>
                <input
                  ref={inputRef}
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, CATALOG_ACCESS_CODE.length);
                    setError(false);
                    setCode(v);
                    if (v.length === CATALOG_ACCESS_CODE.length) tryUnlock(v);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") tryUnlock(code); }}
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label="Kod"
                  placeholder={"•".repeat(CATALOG_ACCESS_CODE.length)}
                  className={cn(
                    "w-full text-center font-mono text-xl tracking-[.5em] rounded-lg border bg-background px-3 py-2 outline-none transition-colors focus:border-primary",
                    error ? "border-red-500 text-red-400" : "border-border text-foreground"
                  )}
                />
              </motion.div>
              <Button
                size="sm"
                className="w-full mt-2 gap-2"
                disabled={code.length !== CATALOG_ACCESS_CODE.length}
                onClick={() => tryUnlock(code)}
              >
                <LockOpen className="h-4 w-4" />
                Odblokuj
              </Button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
