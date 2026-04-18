import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

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
    { to: "/suno", label: t("seo.cta.studio") },
    { to: "/radio", label: t("seo.cta.radio") },
    { to: "/radio-live", label: t("seo.cta.radioLive") },
    { to: "/library", label: t("seo.cta.library") },
    { to: "/movies", label: t("seo.cta.movies") },
    { to: "/mood-history", label: t("seo.cta.mood") },
    { to: "/server", label: t("seo.cta.community") },
    { to: "/auth", label: t("seo.cta.signup") },
    { to: "/legal", label: t("seo.cta.legal") },
  ];

  return (
    <section className="px-6 py-12 max-w-4xl mx-auto">
      <div className="prose prose-invert max-w-none text-muted-foreground text-sm leading-relaxed space-y-6">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          {t("seo.hero.title")}
        </h2>
        <p className="text-base">{renderRich(t("seo.hero.lead"))}</p>

        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          {t("seo.features.title")}
        </h2>
        <ul className="space-y-2 list-disc pl-5">
          {features.map((f, i) => (
            <li key={i}>
              <strong className="text-foreground">{f.title}</strong> — {f.desc}
            </li>
          ))}
        </ul>

        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          {t("seo.earn.title")}
        </h2>
        <p>{renderRich(t("seo.earn.intro"))}</p>

        <div className="space-y-4 not-prose">
          {earnItems.map((item, i) => (
            <div key={i} className="rounded-lg border border-border p-4 bg-card/30">
              <h3 className="text-foreground font-bold mb-1">{item.title}</h3>
              <p className="text-sm">{renderRich(item.desc)}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl md:text-2xl font-bold text-foreground mt-8">
          {t("seo.weekly.title")}
        </h2>

        <div className="space-y-3 not-prose">
          <div className="rounded-lg border border-primary/30 p-4 bg-primary/5">
            <h3 className="text-foreground font-bold mb-1">{t("seo.weekly.beginner.title")}</h3>
            <p className="text-sm">{t("seo.weekly.beginner.desc")}</p>
            <p className="text-foreground font-bold mt-1 text-primary">{t("seo.weekly.beginner.total")}</p>
          </div>

          <div className="rounded-lg border border-accent/30 p-4 bg-accent/5">
            <h3 className="text-foreground font-bold mb-1">{t("seo.weekly.active.title")}</h3>
            <p className="text-sm">{t("seo.weekly.active.desc")}</p>
            <p className="text-foreground font-bold mt-1 text-accent">{t("seo.weekly.active.total")}</p>
          </div>

          <div className="rounded-lg border border-primary/50 p-4 bg-gradient-to-br from-primary/10 to-accent/10">
            <h3 className="text-foreground font-bold mb-1">{t("seo.weekly.pro.title")}</h3>
            <p className="text-sm">{t("seo.weekly.pro.desc")}</p>
            <p className="text-foreground font-bold mt-1 text-primary">{t("seo.weekly.pro.total")}</p>
          </div>
        </div>

        <p className="text-xs italic text-muted-foreground/70 mt-4">
          {t("seo.weekly.disclaimer")}
        </p>

        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          {t("seo.why.title")}
        </h2>
        <ul className="space-y-2 list-disc pl-5">
          {whyList.map((w, i) => (
            <li key={i}>
              <strong className="text-foreground">{w.title}</strong> {w.desc}
            </li>
          ))}
        </ul>

        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          {t("seo.cta.title")}
        </h2>
        <nav className="flex flex-wrap gap-3 text-sm" aria-label="Earning opportunities">
          {ctaLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
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
    </section>
  );
};
