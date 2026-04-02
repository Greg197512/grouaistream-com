import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { HQCover } from "@/components/ui/HQCover";
import { TrackBadges } from "@/components/ui/TrackBadges";
import { Badge } from "@/components/ui/badge";

export const PromotedTracksSection = () => {
  const { playTrack } = usePlayer();
  const [tracks, setTracks] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("tracks")
        .select("*")
        .eq("is_boosted", true)
        .gte("boost_expires_at", new Date().toISOString())
        .order("total_streams", { ascending: false })
        .limit(6);

      if (data) setTracks(data);
    };
    load();
  }, []);

  if (tracks.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Rocket className="h-5 w-5 text-amber-400" />
        <h2 className="text-lg font-bold">Promowane</h2>
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-[10px]">
          BOOST
        </Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {tracks.map((track, i) => (
          <motion.div
            key={track.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => playTrack(track as Track)}
            className="group cursor-pointer"
          >
            <div className="relative aspect-square rounded-lg overflow-hidden bg-white/5 mb-2">
              <HQCover
                src={track.cover_url}
                alt={track.title}
                genre={track.genre}
                artist={track.artist}
                className="h-full w-full group-hover:scale-105 transition-transform"
              />
              <div className="absolute top-1 right-1">
                <TrackBadges
                  isMonetized={track.is_monetized}
                  isBoosted={true}
                  isAIAssisted={track.audio_url?.includes("suno")}
                />
              </div>
            </div>
            <p className="text-xs font-medium truncate">{track.title}</p>
            <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
