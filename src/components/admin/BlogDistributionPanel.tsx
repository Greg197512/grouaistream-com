import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Copy, Check, Mail, Twitter, Loader2, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Post {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  cover_url: string | null;
  created_at: string;
}

interface Hook {
  post_id: string;
  x_hook: string | null;
  telegram_hook: string | null;
  email_hook: string | null;
  email_subject: string | null;
}

interface NewsletterLog {
  id: string;
  post_id: string | null;
  recipients_count: number;
  success_count: number;
  error_count: number;
  status: string;
  created_at: string;
}

const formatDate = (s: string) =>
  new Date(s).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });

export const BlogDistributionPanel = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [hooks, setHooks] = useState<Record<string, Hook>>({});
  const [logs, setLogs] = useState<Record<string, NewsletterLog>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: postData } = await supabase
      .from("seo_blog_posts")
      .select("id, slug, title, description, category, cover_url, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(15);
    const list = (postData as Post[]) || [];
    setPosts(list);

    if (list.length > 0) {
      const ids = list.map((p) => p.id);
      const { data: hookData } = await supabase
        .from("blog_post_hooks")
        .select("post_id, x_hook, telegram_hook, email_hook, email_subject")
        .in("post_id", ids);
      const hMap: Record<string, Hook> = {};
      for (const h of (hookData as Hook[]) || []) hMap[h.post_id] = h;
      setHooks(hMap);

      const { data: logData } = await supabase
        .from("blog_newsletter_log")
        .select("*")
        .in("post_id", ids)
        .order("created_at", { ascending: false });
      const lMap: Record<string, NewsletterLog> = {};
      for (const l of (logData as NewsletterLog[]) || []) {
        if (l.post_id && !lMap[l.post_id]) lMap[l.post_id] = l;
      }
      setLogs(lMap);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("Skopiowano!");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Nie udało się skopiować");
    }
  };

  const sendNewsletter = async (post: Post) => {
    if (!confirm(`Wysłać newsletter "${post.title}" do wszystkich subskrybentów?`)) return;
    setSending(post.id);
    try {
      const { data, error } = await supabase.functions.invoke("notify-blog-subscribers", {
        body: { post_id: post.id },
      });
      if (error) throw error;
      toast.success("Newsletter wysłany!", {
        description: `Dostarczono: ${data?.sent || 0}/${data?.recipients || 0}`,
      });
      await load();
    } catch (e) {
      toast.error("Błąd wysyłki: " + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setSending(null);
    }
  };

  const generateHooks = async (post: Post) => {
    setSending("gen-" + post.id);
    try {
      const { error } = await supabase.functions.invoke("seo-blog-generate-hooks", {
        body: { post_id: post.id },
      });
      if (error) throw error;
      toast.success("Hooki wygenerowane");
      await load();
    } catch {
      // Fallback: AI generation only happens for new posts via seo-blog-generate
      toast.info("Hooki generowane są automatycznie przy nowych postach AI");
    } finally {
      setSending(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Dystrybucja blogu — hooki AI + newsletter
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Gotowe teasery do skopiowania na X, Telegram + 1-klik wysyłka emaili do wszystkich
          potwierdzonych użytkowników (z opcją wypisania).
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[520px]">
          <div className="space-y-3 pr-3">
            {posts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Brak postów. Wygeneruj pierwszy w panelu wyżej.
              </p>
            )}
            {posts.map((post) => {
              const hook = hooks[post.id];
              const log = logs[post.id];
              const isExpanded = expanded === post.id;
              return (
                <motion.div
                  key={post.id}
                  layout
                  className="border border-border rounded-xl p-4 bg-card/50 hover:border-primary/40 transition"
                >
                  <div className="flex items-start gap-3">
                    {post.cover_url && (
                      <img
                        src={post.cover_url}
                        alt=""
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        loading="lazy"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <a
                            href={`/blog/${post.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-sm hover:text-primary line-clamp-2 inline-flex items-center gap-1"
                          >
                            {post.title}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-[9px]">
                              {post.category}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(post.created_at)}
                            </span>
                            {log && (
                              <Badge
                                className={`text-[9px] ${
                                  log.status === "sent"
                                    ? "bg-primary/20 text-primary"
                                    : log.status === "failed"
                                    ? "bg-destructive/20 text-destructive"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                ✉ {log.success_count}/{log.recipients_count}
                              </Badge>
                            )}
                            {!hook && (
                              <Badge variant="outline" className="text-[9px] text-muted-foreground">
                                brak hooków
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setExpanded(isExpanded ? null : post.id)}
                        >
                          {isExpanded ? "Ukryj hooki" : "Pokaż hooki"}
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => sendNewsletter(post)}
                          disabled={sending === post.id}
                        >
                          {sending === post.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          Wyślij newsletter
                        </Button>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-border space-y-3 overflow-hidden"
                      >
                        {hook ? (
                          <>
                            <HookBlock
                              icon={<Twitter className="h-3.5 w-3.5" />}
                              label="X / Twitter"
                              text={hook.x_hook}
                              maxChars={280}
                              copyKey={`x-${post.id}`}
                              copied={copied}
                              onCopy={copy}
                            />
                            <HookBlock
                              icon={<span className="text-xs">✈️</span>}
                              label="Telegram"
                              text={hook.telegram_hook}
                              maxChars={500}
                              copyKey={`tg-${post.id}`}
                              copied={copied}
                              onCopy={copy}
                            />
                            <HookBlock
                              icon={<Mail className="h-3.5 w-3.5" />}
                              label={`Email (subject: ${hook.email_subject || "—"})`}
                              text={hook.email_hook}
                              maxChars={160}
                              copyKey={`em-${post.id}`}
                              copied={copied}
                              onCopy={copy}
                            />
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            Hooki są generowane automatycznie dla nowych postów AI. Stare posty
                            można pominąć — newsletter użyje opisu posta.
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const HookBlock = ({
  icon,
  label,
  text,
  maxChars,
  copyKey,
  copied,
  onCopy,
}: {
  icon: React.ReactNode;
  label: string;
  text: string | null;
  maxChars: number;
  copyKey: string;
  copied: string | null;
  onCopy: (t: string, k: string) => void;
}) => {
  if (!text) return null;
  const len = text.length;
  return (
    <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          {icon}
          {label}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] ${len > maxChars ? "text-destructive" : "text-muted-foreground"}`}>
            {len}/{maxChars}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => onCopy(text, copyKey)}
          >
            {copied === copyKey ? (
              <Check className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  );
};
