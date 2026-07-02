import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, FileText, Link2, Image, Tag, Star,
  Trash2, Sparkles, BookOpen, ArrowUpRight, Loader2,
} from "lucide-react";
import { EmpireLayout } from "@/components/empire/EmpireLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type NoteType = "note" | "link" | "image" | "insight";

interface Note {
  id: string;
  title: string;
  content: string;
  type: NoteType;
  tags: string[];
  starred: boolean;
  created_at: string;
  ai_insight?: string | null;
}

const TYPE_CONFIG: Record<NoteType, { icon: React.ReactNode; color: string; label: string }> = {
  note: { icon: <FileText className="w-3.5 h-3.5" />, color: "text-teal-400 bg-teal-400/10", label: "Notatka" },
  link: { icon: <Link2 className="w-3.5 h-3.5" />, color: "text-blue-400 bg-blue-400/10", label: "Link" },
  image: { icon: <Image className="w-3.5 h-3.5" />, color: "text-purple-400 bg-purple-400/10", label: "Obraz" },
  insight: { icon: <Sparkles className="w-3.5 h-3.5" />, color: "text-yellow-400 bg-yellow-400/10", label: "AI Insight" },
};

export default function KnowledgeGarden() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<Note | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await (supabase as any)
        .from("empire_knowledge_notes")
        .select("id, title, content, type, tags, starred, created_at, ai_insight")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      setNotes((data as Note[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags ?? [])));

  const filtered = notes.filter((n) => {
    const matchSearch =
      !search ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      (n.content ?? "").toLowerCase().includes(search.toLowerCase());
    const matchTag = !activeTag || (n.tags ?? []).includes(activeTag);
    return matchSearch && matchTag;
  });

  const addNote = async () => {
    if (!newTitle.trim() || saving) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data, error } = await (supabase as any)
      .from("empire_knowledge_notes")
      .insert({
        user_id: user.id,
        title: newTitle,
        content: newContent,
        type: "note",
        tags: [],
        starred: false,
      })
      .select()
      .single();

    if (!error && data) {
      const note = data as Note;
      setNotes((prev) => [note, ...prev]);
      setSelected(note);
    }
    setNewTitle("");
    setNewContent("");
    setCreating(false);
    setSaving(false);
  };

  const toggleStar = async (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    const next = !note.starred;
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, starred: next } : n)));
    if (selected?.id === id) setSelected((s) => s ? { ...s, starred: next } : s);
    await (supabase as any).from("empire_knowledge_notes").update({ starred: next }).eq("id", id);
  };

  const deleteNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selected?.id === id) setSelected(null);
    await (supabase as any).from("empire_knowledge_notes").delete().eq("id", id);
  };

  return (
    <EmpireLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-white/8 bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal-400" />
            <h1 className="text-base font-semibold text-white">Knowledge Garden</h1>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 flex-1 max-w-sm ml-4">
            <Search className="w-3.5 h-3.5 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj w ogrodzie wiedzy…"
              className="bg-transparent text-sm text-white/80 placeholder:text-white/30 outline-none flex-1"
            />
          </div>
          <Button
            onClick={() => setCreating(true)}
            size="sm"
            className="ml-auto bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-500 hover:to-purple-500 border-0 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nowa notatka
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Notes list */}
          <div className="w-72 border-r border-white/8 flex flex-col overflow-hidden bg-black/20">
            {/* Tags */}
            <div className="px-3 py-3 border-b border-white/8 flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveTag(null)}
                className={cn(
                  "text-xs rounded-full px-2.5 py-1 transition-colors",
                  !activeTag
                    ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                    : "bg-white/5 text-white/40 border border-white/10 hover:text-white/70"
                )}
              >
                Wszystkie
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={cn(
                    "text-xs rounded-full px-2.5 py-1 transition-colors flex items-center gap-1",
                    activeTag === tag
                      ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                      : "bg-white/5 text-white/40 border border-white/10 hover:text-white/70"
                  )}
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <AnimatePresence>
                {creating && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-3 space-y-2"
                  >
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addNote()}
                      placeholder="Tytuł notatki…"
                      className="w-full bg-transparent text-sm font-medium text-white placeholder:text-white/30 outline-none"
                    />
                    <textarea
                      rows={2}
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder="Treść…"
                      className="w-full bg-transparent text-xs text-white/70 placeholder:text-white/30 outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={addNote}
                        disabled={saving}
                        className="text-xs bg-teal-600 hover:bg-teal-500 text-white rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                        Dodaj
                      </button>
                      <button
                        onClick={() => setCreating(false)}
                        className="text-xs text-white/40 hover:text-white/70 transition-colors"
                      >
                        Anuluj
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
                </div>
              ) : (
                filtered.map((note) => {
                  const type = (note.type in TYPE_CONFIG ? note.type : "note") as NoteType;
                  const cfg = TYPE_CONFIG[type];
                  return (
                    <motion.button
                      key={note.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setSelected(note)}
                      className={cn(
                        "w-full text-left bg-white/5 hover:bg-white/8 border rounded-xl p-3.5 transition-all",
                        selected?.id === note.id
                          ? "border-teal-500/40 bg-teal-500/8"
                          : "border-white/10 hover:border-white/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={cn("flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5", cfg.color)}>
                          {cfg.icon} {cfg.label}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleStar(note.id); }}
                          className={cn("flex-shrink-0 transition-colors", note.starred ? "text-yellow-400" : "text-white/20 hover:text-yellow-400")}
                        >
                          <Star className="w-3.5 h-3.5" fill={note.starred ? "currentColor" : "none"} />
                        </button>
                      </div>
                      <p className="text-sm font-medium text-white leading-snug mb-1 line-clamp-2">{note.title}</p>
                      <p className="text-xs text-white/40 line-clamp-2">{note.content}</p>
                      {(note.tags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {note.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[10px] bg-white/8 text-white/40 rounded px-1.5 py-0.5">{tag}</span>
                          ))}
                        </div>
                      )}
                    </motion.button>
                  );
                })
              )}

              {!loading && filtered.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="w-8 h-8 text-white/15 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">Brak notatek</p>
                </div>
              )}
            </div>
          </div>

          {/* Detail view */}
          <div className="flex-1 overflow-y-auto">
            {selected ? (
              <div className="max-w-2xl mx-auto px-8 py-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1",
                      TYPE_CONFIG[(selected.type in TYPE_CONFIG ? selected.type : "note") as NoteType].color
                    )}>
                      {TYPE_CONFIG[(selected.type in TYPE_CONFIG ? selected.type : "note") as NoteType].icon}
                      {TYPE_CONFIG[(selected.type in TYPE_CONFIG ? selected.type : "note") as NoteType].label}
                    </span>
                    <span className="text-xs text-white/30">
                      {new Date(selected.created_at).toLocaleDateString("pl-PL")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleStar(selected.id)}
                      className={cn("p-1.5 rounded-lg transition-colors", selected.starred ? "text-yellow-400" : "text-white/30 hover:text-yellow-400")}
                    >
                      <Star className="w-4 h-4" fill={selected.starred ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={() => deleteNote(selected.id)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h1 className="text-2xl font-bold text-white mb-4">{selected.title}</h1>
                <p className="text-white/70 leading-relaxed mb-6">{selected.content}</p>

                {(selected.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {selected.tags.map((tag) => (
                      <span key={tag} className="flex items-center gap-1 text-xs bg-white/8 text-white/50 rounded-full px-3 py-1">
                        <Tag className="w-2.5 h-2.5" /> {tag}
                      </span>
                    ))}
                  </div>
                )}

                {selected.ai_insight && (
                  <div className="bg-gradient-to-r from-teal-500/10 to-purple-500/10 border border-teal-500/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-teal-400" />
                      <span className="text-sm font-semibold text-teal-400">AI Insight</span>
                    </div>
                    <p className="text-sm text-white/70">{selected.ai_insight}</p>
                    <button className="mt-3 flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors">
                      Generuj content z tego <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <BookOpen className="w-12 h-12 text-white/15 mb-4" />
                <p className="text-white/40 text-sm mb-1">Wybierz notatkę</p>
                <p className="text-white/25 text-xs">lub utwórz nową, aby zacząć</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </EmpireLayout>
  );
}
