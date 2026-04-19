import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { display_name: string | null; avatar_url: string | null };
}

interface Props {
  postId: string;
}

export const BlogComments = ({ postId }: Props) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: cs } = await supabase
      .from("blog_comments")
      .select("id, user_id, content, created_at")
      .eq("post_id", postId)
      .eq("is_hidden", false)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(100);

    const list = (cs || []) as Comment[];
    if (list.length > 0) {
      const userIds = Array.from(new Set(list.map((c) => c.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p]));
      list.forEach((c) => {
        const p = map.get(c.user_id);
        c.profile = p ? { display_name: p.display_name, avatar_url: p.avatar_url } : undefined;
      });
    }
    setComments(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [postId]);

  const submit = async () => {
    if (!user) return toast.error("Zaloguj się, by skomentować");
    const text = newComment.trim();
    if (text.length < 2) return toast.error("Komentarz jest za krótki");
    if (text.length > 2000) return toast.error("Maks. 2000 znaków");
    setPosting(true);
    const { error } = await supabase.from("blog_comments").insert({
      post_id: postId,
      user_id: user.id,
      content: text,
    });
    setPosting(false);
    if (error) {
      toast.error("Nie udało się dodać komentarza");
      return;
    }
    setNewComment("");
    toast.success("Dodano komentarz");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("blog_comments").delete().eq("id", id);
    if (error) return toast.error("Nie udało się usunąć");
    setComments((cs) => cs.filter((c) => c.id !== id));
  };

  return (
    <section id="komentarze" className="mt-16 pt-10 border-t border-border/60">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">Komentarze ({comments.length})</h2>
      </div>

      {user ? (
        <div className="mb-8 p-4 rounded-xl bg-card/40 border border-border">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Co o tym myślisz?"
            rows={3}
            maxLength={2000}
            className="bg-background/50 border-border resize-none"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-foreground">{newComment.length}/2000</span>
            <Button onClick={submit} disabled={posting || newComment.trim().length < 2} size="sm">
              {posting ? "Wysyłanie…" : "Opublikuj"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-8 p-4 rounded-xl bg-card/40 border border-border text-center">
          <p className="text-sm text-muted-foreground mb-3">Zaloguj się, by dołączyć do dyskusji</p>
          <Link to="/auth">
            <Button size="sm" variant="outline">Zaloguj się</Button>
          </Link>
        </div>
      )}

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-8">Ładowanie…</div>
      ) : comments.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">
          Jeszcze nikt nic nie napisał. Bądź pierwszy.
        </div>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => {
            const name = c.profile?.display_name || "Anonim";
            const initials = name.slice(0, 2).toUpperCase();
            const date = new Date(c.created_at).toLocaleDateString("pl-PL", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <li key={c.id} className="flex gap-3 p-4 rounded-xl bg-card/30 border border-border/60 hover:border-primary/30 transition-colors">
                <Avatar className="w-9 h-9 shrink-0">
                  {c.profile?.avatar_url && <AvatarImage src={c.profile.avatar_url} alt={name} />}
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-foreground">{name}</span>
                      <span className="text-muted-foreground">· {date}</span>
                    </div>
                    {user?.id === c.user_id && (
                      <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive transition-colors" aria-label="Usuń">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{c.content}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
