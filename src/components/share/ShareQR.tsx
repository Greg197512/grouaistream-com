import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { QrCode, Copy, Share2, Radio, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ShareQRProps {
  /** Link zakodowany w kodzie QR. Domyślnie adres strony głównej. */
  url?: string;
  /** Tytuł pokazywany w oknie natywnego "Udostępnij" i w treści NDEF. */
  title?: string;
  /** Mniejsza wersja (np. w oknie dialogowym dla pojedynczego utworu). */
  compact?: boolean;
}

/**
 * Udostępnianie przez QR + zapis linku na fizycznej karcie/naklejce NFC
 * (Web NFC — tylko Android/Chrome, wymaga prawdziwego taga NFC w zasięgu;
 * sam telefon-do-telefonu "w locie" NIE istnieje jako standard webowy —
 * żadna przeglądarka nie pozwala wysłać danych NFC bezpośrednio do innego
 * telefonu, tylko zapisać/odczytać fizyczny tag. Mówimy to wprost w UI,
 * żeby nie obiecywać czegoś, czego technologia nie potrafi).
 */
export function ShareQR({ url, title = "GrouAI Stream", compact = false }: ShareQRProps) {
  const shareUrl = url || (typeof window !== "undefined" ? window.location.origin : "https://grouaistream.com");
  const [writingNfc, setWritingNfc] = useState(false);
  const nfcSupported = typeof window !== "undefined" && "NDEFReader" in window;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("🔗 Link skopiowany");
  };

  const nativeShare = async () => {
    const nav = navigator as any;
    if (nav.share) {
      try { await nav.share({ title, url: shareUrl }); } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  const writeToNfcTag = async () => {
    if (!nfcSupported) {
      toast.info("NFC działa tylko na Androidzie w Chrome — na tym urządzeniu użyj kodu QR.", { duration: 6000 });
      return;
    }
    setWritingNfc(true);
    try {
      const Ndef = (window as any).NDEFReader;
      const reader = new Ndef();
      toast.info("📡 Przyłóż pustą kartę/naklejkę NFC do tyłu telefonu…", { duration: 8000 });
      await reader.write({ records: [{ recordType: "url", data: shareUrl }] });
      toast.success("✅ Link zapisany na karcie NFC — każdy kto ją przyłoży, otworzy stronę");
    } catch (e: any) {
      if (e?.name === "NotAllowedError") {
        toast.error("Brak zgody na NFC — włącz uprawnienie w ustawieniach przeglądarki");
      } else {
        toast.error("Nie udało się zapisać — upewnij się, że NFC jest włączone i przyłóż kartę bliżej");
      }
    } finally {
      setWritingNfc(false);
    }
  };

  return (
    <div className={compact ? "flex flex-col items-center gap-3" : "flex flex-col items-center gap-4"}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-3 rounded-2xl shadow-lg"
      >
        <QRCodeSVG
          value={shareUrl}
          size={compact ? 160 : 200}
          level="H"
          bgColor="#FFFFFF"
          fgColor="#1a1a2e"
          imageSettings={{ src: "/favicon.png", height: 32, width: 32, excavate: true }}
        />
      </motion.div>

      <p className="text-xs text-muted-foreground text-center break-all max-w-xs">{shareUrl}</p>

      <div className="flex gap-2 w-full max-w-xs">
        <Button onClick={copyLink} variant="outline" size="sm" className="flex-1 gap-1.5">
          <Copy className="h-3.5 w-3.5" /> Kopiuj
        </Button>
        <Button onClick={nativeShare} size="sm" className="flex-1 gap-1.5">
          <Share2 className="h-3.5 w-3.5" /> Udostępnij
        </Button>
      </div>

      {/* NFC — uczciwie: zapis na fizyczny tag, nie magiczny transfer telefon-telefon */}
      <div className="w-full max-w-xs rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
          <Radio className="h-3.5 w-3.5 text-[#9333EA]" /> NFC
        </div>
        {nfcSupported ? (
          <>
            <Button onClick={writeToNfcTag} disabled={writingNfc} variant="outline" size="sm" className="w-full gap-1.5 border-[#9333EA]/30">
              {writingNfc ? <Radio className="h-3.5 w-3.5 animate-pulse" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {writingNfc ? "Czekam na kartę…" : "Zapisz link na karcie NFC"}
            </Button>
            <p className="text-[10px] text-gray-500">Potrzebujesz pustej naklejki/karty NFC (tzw. NFC tag) — przyłożysz ją do telefonu, a link się na niej zapisze. Każdy kto potem przyłoży telefon do tej karty, otworzy stronę.</p>
          </>
        ) : (
          <p className="text-[10px] text-gray-500 flex items-start gap-1.5">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            To urządzenie/przeglądarka nie wspiera zapisu NFC (działa tylko na Androidzie w Chrome, i potrzebny jest fizyczny tag NFC — żadna przeglądarka nie potrafi wysłać danych NFC wprost do drugiego telefonu). Użyj kodu QR powyżej — działa wszędzie.
          </p>
        )}
      </div>
    </div>
  );
}
