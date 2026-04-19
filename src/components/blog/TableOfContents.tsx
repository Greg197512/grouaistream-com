import { useEffect, useMemo, useState } from "react";

interface Heading {
  id: string;
  text: string;
  level: number;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => ({ ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" }[c] || c))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const extractHeadings = (markdown: string): Heading[] => {
  const lines = markdown.split("\n");
  const out: Heading[] = [];
  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (m) {
      const text = m[2].replace(/[*_`]/g, "").trim();
      out.push({ id: slugify(text), text, level: m[1].length });
    }
  }
  return out;
};

interface Props {
  markdown: string;
}

export const TableOfContents = ({ markdown }: Props) => {
  const headings = useMemo(() => extractHeadings(markdown), [markdown]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveId(e.target.id);
        });
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );
    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="Spis treści" className="hidden xl:block sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
      <div className="text-[10px] uppercase tracking-[0.25em] text-primary/80 font-bold mb-3">
        Spis treści
      </div>
      <ul className="space-y-1.5 border-l border-primary/20">
        {headings.map((h) => (
          <li key={h.id} className={h.level === 3 ? "pl-3" : ""}>
            <a
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(h.id);
                if (el) {
                  window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
                  history.replaceState(null, "", `#${h.id}`);
                }
              }}
              className={`block pl-3 -ml-px border-l-2 py-1 text-xs leading-relaxed transition-all ${
                activeId === h.id
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
