import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic2, Check, Trash2, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SavedVoice {
  id: string;
  voice_id: string;
  label: string;
  is_default: boolean;
  created_at: string;
}

interface VoiceLibraryProps {
  selectedVoiceId: string | null;
  onSelect: (voiceId: string | null, label: string | null) => void;
  /** Bumped by parent after a fresh clone to trigger refetch */
  refreshKey?: number;
}

export const VoiceLibrary = ({ selectedVoiceId, onSelect, refreshKey = 0 }: VoiceLibraryProps) => {
  const { user } = useAuth();
  const [voices, setVoices] = useState<SavedVoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) { setVoices([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_voices")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setVoices((data as SavedVoice[]) || []);

      // Auto-select default if none chosen yet
      if (!selectedVoiceId && data && data.length > 0) {
        const def = data.find((v: any) => v.is_default) || data[0];
        onSelect(def.voice_id, def.label);
      }
    } catch (err: any) {
      console.error("[VoiceLibrary] load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, refreshKey]);

  const remove = async (v: SavedVoice) => {
    if (!confirm(`Usunąć głos "${v.label}"?`)) return;
    setDeletingId(v.id);
    try {
      const { error } = await supabase.from("user_voices").delete().eq("id", v.id);
      if (error) throw error;
      toast.success("Głos usunięty");
      if (selectedVoiceId === v.voice_id) onSelect(null, null);
      setVoices(prev => prev.filter(x => x.id !== v.id));
    } catch (err: any) {
      toast.error("Błąd: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (!user || voices.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="p-4 rounded-xl border border-[#FF6B00]/25 bg-[#1a1a2e]/60 space-y-3"
    >
      <div className="flex items-center justify-between">
        <Label className="text-sm text-gray-200 flex items-center gap-2">
          <Mic2 className="h-4 w-4 text-[#FF9500]" />
          Twoje sklonowane głosy ({voices.length})
        </Label>
        {selectedVoiceId && (
          <button
            onClick={() => onSelect(null, null)}
            className="text-xs text-gray-400 hover:text-gray-200"
          >
            Użyj domyślnego ✕
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        <AnimatePresence>
          {voices.map((v) => {
            const active = selectedVoiceId === v.voice_id;
            return (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${
                  active
                    ? "border-[#FF6B00]/60 bg-gradient-to-r from-[#FF6B00]/15 to-[#9333EA]/10"
                    : "border-[#FF6B00]/15 bg-[#0F0F1A]/60 hover:border-[#FF6B00]/35"
                }`}
              >
                <button
                  onClick={() => onSelect(v.voice_id, v.label)}
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    active ? "bg-[#FF6B00]/30 border border-[#FF6B00]" : "bg-[#1a1a2e] border border-gray-700"
                  }`}>
                    {active ? <Check className="h-3.5 w-3.5 text-[#FF9500]" /> : <Mic2 className="h-3.5 w-3.5 text-gray-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{v.label}</p>
                    <p className="text-[10px] text-gray-500">
                      {new Date(v.created_at).toLocaleDateString("pl-PL")}
                    </p>
                  </div>
                  {v.is_default && (
                    <Badge className="bg-[#9333EA]/20 text-[#C084FC] border-[#9333EA]/40 text-[10px] gap-1">
                      <Star className="h-2.5 w-2.5 fill-current" /> domyślny
                    </Badge>
                  )}
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(v)}
                  disabled={deletingId === v.id}
                  className="h-8 w-8 p-0 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                >
                  {deletingId === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {loading && <p className="text-xs text-gray-500 text-center">Ładowanie...</p>}
    </motion.div>
  );
};
