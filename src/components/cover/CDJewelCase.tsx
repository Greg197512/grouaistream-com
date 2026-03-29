import { useState } from "react";
import { Disc3 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface CDJewelCaseProps {
  frontCover: string;
  backCover?: string;
  title: string;
  artist: string;
}

export const CDJewelCase = ({ frontCover, backCover, title, artist }: CDJewelCaseProps) => {
  const { t } = useLanguage();
  const [showBack, setShowBack] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative cursor-pointer group"
        onClick={() => setShowBack(!showBack)}
        style={{ perspective: "1000px" }}
      >
        <div
          className="relative transition-transform duration-700"
          style={{
            transformStyle: "preserve-3d",
            transform: showBack ? "rotateY(180deg)" : "rotateY(0deg)",
            width: "280px",
            height: "280px",
          }}
        >
          {/* Front */}
          <div className="absolute inset-0 rounded-sm overflow-hidden" style={{ backfaceVisibility: "hidden" }}>
            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 p-[6px] rounded-sm shadow-2xl">
              <div className="relative w-full h-full rounded-[2px] overflow-hidden">
                {frontCover ? (
                  <img src={frontCover} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                    <Disc3 className="h-16 w-16 text-muted-foreground animate-spin" style={{ animationDuration: "8s" }} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-white/20 via-white/5 to-white/15" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <p className="text-white text-sm font-semibold truncate">{title || "Untitled"}</p>
              {artist && <p className="text-white/60 text-xs truncate">{artist}</p>}
            </div>
          </div>

          {/* Back */}
          <div className="absolute inset-0 rounded-sm overflow-hidden" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 p-[6px] rounded-sm shadow-2xl">
              <div className="relative w-full h-full rounded-[2px] overflow-hidden">
                {backCover ? (
                  <img src={backCover} alt={`${title} - back`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex flex-col items-center justify-center p-4 text-center">
                    <p className="text-muted-foreground text-sm mb-2">{t("cover.backCover")}</p>
                    <p className="text-muted-foreground/60 text-xs">{t("cover.genBackSide")}</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {t("cover.clickToFlip")}
        </p>
      </div>

      {/* CD Disc */}
      <div className="relative w-20 h-20 -mt-4">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-zinc-400 via-zinc-300 to-zinc-500 shadow-lg">
          <div className="absolute inset-[30%] rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/20 to-transparent" />
          <div className="absolute inset-[10%] rounded-full opacity-30"
            style={{ background: "conic-gradient(from 0deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0000)" }}
          />
        </div>
      </div>
    </div>
  );
};
