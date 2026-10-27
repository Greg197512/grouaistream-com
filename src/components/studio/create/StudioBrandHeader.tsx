import { ShieldCheck, Sparkles } from "lucide-react";

type Props = {
  L: (pl: string, en: string, nl: string, ua: string) => string;
  poweredBy: React.ReactNode;
};

/** Nagłówek GrouAI Studio: znak, nazwa, odznaka „Verified Human Streams” i status studia. */
export function StudioBrandHeader({ L, poweredBy }: Props) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-[#1E2A44] bg-[radial-gradient(120%_140%_at_0%_0%,#1a1406_0%,#0B1020_45%,#070A14_100%)] p-5 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#3B82F6]/15 blur-3xl" />
      <div className="relative flex flex-wrap items-start gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFE08A] via-[#F5B73B] to-[#B7791F] shadow-[0_0_28px_rgba(245,183,59,0.35)]">
            <span className="font-display text-3xl font-black leading-none text-[#1a1203]">G</span>
            <span aria-hidden className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#0B1020] bg-[#3B82F6]" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-black leading-none tracking-tight text-white sm:text-4xl">
              GrouAI <span className="bg-gradient-to-r from-[#FFE08A] to-[#F5B73B] bg-clip-text text-transparent">Studio</span>
            </h1>
            <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-[#F5B73B]/80">AI Music Creation · GrouaRock ®</p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 shadow-[0_0_18px_rgba(34,197,94,0.25)]"
            title={L("Odsłuchy liczone tylko od zweryfikowanych ludzi — bez botów i farm streamów", "Streams are counted only from verified humans — no bots, no stream farms", "Streams tellen alleen van geverifieerde mensen — geen bots", "Прослуховування рахуються лише від перевірених людей — без ботів")}
          >
            <ShieldCheck className="h-4 w-4" /> Verified Human Streams
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34D399]" />
            {L("Studio gotowe", "Studio ready", "Studio klaar", "Студія готова")}
          </span>
        </div>
      </div>
      <p className="relative mt-4 max-w-xl text-sm leading-relaxed text-gray-400">
        {L("Twój pomysł. Twój głos. Twoje brzmienie.", "Your idea. Your voice. Your sound.", "Jouw idee. Jouw stem. Jouw geluid.", "Твоя ідея. Твій голос. Твоє звучання.")}
      </p>
      <p className="relative mt-2 flex items-start gap-1.5 text-xs text-gray-400">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F5B73B]" /><span>{poweredBy}</span>
      </p>
    </header>
  );
}
