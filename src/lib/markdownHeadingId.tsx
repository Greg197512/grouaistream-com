// Plugin for react-markdown to add slug ids to h2/h3 headings (matches TableOfContents extractHeadings)
import type { Components } from "react-markdown";
import type { ReactNode } from "react";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => ({ ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" }[c] || c))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const textOf = (children: ReactNode): string => {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  if (children && typeof children === "object" && "props" in (children as any)) {
    return textOf((children as any).props.children);
  }
  return "";
};

export const headingComponents: Pick<Components, "h2" | "h3"> = {
  h2: ({ children, ...props }) => (
    <h2 id={slugify(textOf(children))} {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 id={slugify(textOf(children))} {...props}>
      {children}
    </h3>
  ),
};
