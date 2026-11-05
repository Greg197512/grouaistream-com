// Tłumaczenie bloga PL → EN/NL/UA (zamiast funkcji blog-translate z Grokiem): darmowy tryb tłumacza
// w /api/assistant, wynik w kolumnach *_en/_nl/_ua tabeli seo_blog_posts (admin, RLS).
import { supabase } from "@/integrations/supabase/client";
import { invokeHubAI } from "@/lib/hubAI";

const LANGS = [["en", "English"], ["nl", "Dutch"], ["ua", "Ukrainian"]] as const;

async function tr(text: string, target: string): Promise<string> {
  if (!text?.trim()) return "";
  const { data, error } = await invokeHubAI({ message: text.slice(0, 12000), mode: "translate", userContext: { target } }, 60000);
  if (error || !data?.response) throw error ?? new Error("brak tłumaczenia");
  return data.response.trim();
}

/** Tłumaczy do `limit` opublikowanych wpisów, którym brakuje wersji EN. Zwraca liczbę przetłumaczonych. */
export async function translateBlogBatch(limit = 5): Promise<number> {
  const { data, error } = await supabase.from("seo_blog_posts")
    .select("id,title,description,content").eq("is_published", true).is("title_en", null)
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  let done = 0;
  for (const p of (data ?? []) as { id: string; title: string; description: string; content: string }[]) {
    const patch: Record<string, string> = {};
    for (const [code, name] of LANGS) {
      patch[`title_${code}`] = await tr(p.title, name);
      patch[`description_${code}`] = await tr(p.description, name);
      patch[`content_${code}`] = await tr(p.content, name);
    }
    const { error: e2 } = await supabase.from("seo_blog_posts").update(patch as never).eq("id", p.id);
    if (e2) throw e2;
    done++;
  }
  return done;
}
