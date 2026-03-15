import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Music, Calendar, Heart } from "lucide-react";
import { WaveformPlayer } from "./WaveformPlayer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Generation {
  id: string;
  title: string;
  genre: string;
  audio_url: string | null;
  instrumental: boolean;
  created_at: string;
  status: string;
}

export const GenerationHistory = () => {
  const { user } = useAuth();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadGenerations();
  }, [user]);

  const loadGenerations = async () => {
    const { data, error } = await supabase
      .from("generations")
      .select("*")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) setGenerations(data as Generation[]);
    setLoading(false);
  };

  const saveToFavorites = async (genId: string) => {
    if (!user) return;
    const { error } = await supabase.from("favorites").insert({
      user_id: user.id,
      generation_id: genId,
    });
    if (error) {
      if (error.code === "23505") toast.info("Już jest w ulubionych!");
      else toast.error("Błąd zapisu");
    } else {
      toast.success("Dodano do ulubionych! ❤️");
    }
  };

  if (!user || loading) return null;
  if (generations.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2 text-[#FF9500]">
        <Music className="h-5 w-5" />
        Historia generacji
      </h2>
      <div className="grid gap-3">
        {generations.map((gen) => (
          <div
            key={gen.id}
            className="p-4 rounded-xl border border-[#FF6B00]/20 bg-[#1a1a2e]/60 backdrop-blur-sm hover:border-[#FF6B00]/40 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-sm text-white">{gen.title}</p>
                <p className="text-xs text-[#FF9500]/70">
                  {gen.genre} {gen.instrumental && "• Instrumental"} • 30s
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(gen.created_at).toLocaleDateString("pl-PL")}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-[#FF6B00] hover:text-[#FF9500]"
                  onClick={() => saveToFavorites(gen.id)}
                >
                  <Heart className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {gen.audio_url && (
              <WaveformPlayer audioUrl={gen.audio_url} title={gen.title} genre={gen.genre} compact />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
