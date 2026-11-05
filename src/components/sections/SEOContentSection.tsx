import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChevronRight, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Render **bold** within a string, returning React fragments
const renderRich = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="text-foreground">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
};

export const SEOContentSection = () => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  // Pipe-separated bullets: "Title|Description||Title|Description"
  const features = t("seo.features.list").split("||").map((entry) => {
    const [title, desc] = entry.split("|");
    return { title, desc };
  });

  const whyList = t("seo.why.list").split("||").map((entry) => {
    const [title, desc] = entry.split("|");
    return { title, desc };
  });

  const earnItems = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
    title: t(`seo.earn.item${n}.title`),
    desc: t(`seo.earn.item${n}.desc`),
  }));

  const ctaLinks = [
    { to: "/earn", label: t("seo.cta.earn"), bold: true },
    { to: "/earnings", label: t("seo.cta.earnings") },
    { to: "/upload", label: t("seo.cta.upload") },
    { to: "/studio", label: t("seo.cta.studio") },
    { to: "/radio", label: t("seo.cta.radio") },
    { to: "/radio-live", label: t("seo.cta.radioLive") },
    { to: "/library", label: t("seo.cta.library") },
    { to: "/movies", label: t("seo.cta.movies") },
    { to: "/mood-history", label: t("seo.cta.mood") },
    { to: "/server", label: t("seo.cta.community") },
    { to: "/auth", label: t("seo.cta.signup") },
    { to: "/legal", label: t("seo.cta.legal") },
  ];

  const buttonLabel = t("seo.hero.button");

  return (
    <section className="px-6 py-12 max-w-4xl mx-auto">
      {/* Statyczna karta (bez animacji — lekko i czytelnie na telefonie) */}
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card/60 to-accent/10 p-6 shadow-lg md:p-8">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> GrouAI Stream
        </div>
        <h2 className="mb-3 text-2xl font-bold leading-tight text-foreground [text-wrap:balance] md:text-3xl">
          {t("seo.hero.title")}
        </h2>
        <p className="m-0 text-base leading-relaxed text-muted-foreground">
          {renderRich(t("seo.hero.lead"))}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-center text-sm font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto md:text-base"
        >
          {buttonLabel}
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      </div>

      {/* Modal z pełną treścią — także w płonącej ramce */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-6">
          <div className="max-h-[85vh] overflow-hidden">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
                GrouAI Stream
              </DialogTitle>
            </DialogHeader>

            <div className="overflow-y-auto pr-2 max-h-[72vh] groove-scrollbar">
              <div className="prose prose-invert max-w-none text-muted-foreground text-sm leading-relaxed space-y-6">
                <h3 className="text-xl md:text-2xl font-bold text-foreground">
                  {t("seo.features.title")}
                </h3>
                <ul className="space-y-2 list-disc pl-5">
                  {features.map((f, i) => (
                    <li key={i}>
                      <strong className="text-foreground">{f.title}</strong> — {f.desc}
                    </li>
                  ))}
                </ul>

                <h3 className="text-xl md:text-2xl font-bold text-foreground">
                  {t("seo.earn.title")}
                </h3>
                <p>{renderRich(t("seo.earn.intro"))}</p>

                <div className="space-y-4 not-prose">
                  {earnItems.map((item, i) => (
                    <div key={i} className="rounded-lg border border-border p-4 bg-card/30">
                      <h4 className="text-foreground font-bold mb-1">{item.title}</h4>
                      <p className="text-sm">{renderRich(item.desc)}</p>
                    </div>
                  ))}
                </div>

                <h3 className="text-xl md:text-2xl font-bold text-foreground mt-8">
                  {t("seo.weekly.title")}
                </h3>

                <div className="space-y-3 not-prose">
                  <div className="rounded-lg border border-primary/30 p-4 bg-primary/5">
                    <h4 className="text-foreground font-bold mb-1">{t("seo.weekly.beginner.title")}</h4>
                    <p className="text-sm">{t("seo.weekly.beginner.desc")}</p>
                    <p className="text-foreground font-bold mt-1 text-primary">{t("seo.weekly.beginner.total")}</p>
                  </div>

                  <div className="rounded-lg border border-accent/30 p-4 bg-accent/5">
                    <h4 className="text-foreground font-bold mb-1">{t("seo.weekly.active.title")}</h4>
                    <p className="text-sm">{t("seo.weekly.active.desc")}</p>
                    <p className="text-foreground font-bold mt-1 text-accent">{t("seo.weekly.active.total")}</p>
                  </div>

                  <div className="rounded-lg border border-primary/50 p-4 bg-gradient-to-br from-primary/10 to-accent/10">
                    <h4 className="text-foreground font-bold mb-1">{t("seo.weekly.pro.title")}</h4>
                    <p className="text-sm">{t("seo.weekly.pro.desc")}</p>
                    <p className="text-foreground font-bold mt-1 text-primary">{t("seo.weekly.pro.total")}</p>
                  </div>
                </div>

                <p className="text-xs italic text-muted-foreground/70 mt-4">
                  {t("seo.weekly.disclaimer")}
                </p>

                <h3 className="text-xl md:text-2xl font-bold text-foreground">
                  {t("seo.why.title")}
                </h3>
                <ul className="space-y-2 list-disc pl-5">
                  {whyList.map((w, i) => (
                    <li key={i}>
                      <strong className="text-foreground">{w.title}</strong> {w.desc}
                    </li>
                  ))}
                </ul>

                <h3 className="text-xl md:text-2xl font-bold text-foreground">
                  {t("seo.cta.title")}
                </h3>
                <nav className="flex flex-wrap gap-3 text-sm" aria-label="Earning opportunities">
                  {ctaLinks.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setOpen(false)}
                      className={`text-primary hover:text-primary/80 underline underline-offset-4 ${l.bold ? "font-semibold" : ""}`}
                    >
                      {l.label}
                    </Link>
                  ))}
                </nav>

                <p className="text-xs text-muted-foreground/60 pt-6 border-t border-border/50">
                  {renderRich(t("seo.footer"))}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};
