import { motion } from "framer-motion";
import { Play, Clock } from "lucide-react";

const recentTracks = [
  { id: "1", title: "Midnight Dreams", artist: "Aurora Beats", time: "2 min ago" },
  { id: "2", title: "Electric Soul", artist: "Neon Wave", time: "15 min ago" },
  { id: "3", title: "Sunset Boulevard", artist: "The Groove Masters", time: "1 hour ago" },
  { id: "4", title: "Digital Love", artist: "Synthia", time: "2 hours ago" },
  { id: "5", title: "Cloud Nine", artist: "Sky Walker", time: "3 hours ago" },
  { id: "6", title: "Rhythm Divine", artist: "Beat Collective", time: "5 hours ago" },
];

export const RecentlyPlayed = () => {
  return (
    <section className="px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-display text-xl font-bold">Jump Back In</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {recentTracks.map((track, index) => (
          <motion.div
            key={track.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 p-3 rounded-md bg-secondary/50 hover:bg-secondary group cursor-pointer transition-colors"
          >
            <div className="relative h-12 w-12 rounded overflow-hidden flex-shrink-0">
              <div className="absolute inset-0 groove-gradient-bg opacity-70" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                <Play className="h-4 w-4 text-white fill-current" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{track.title}</p>
              <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">{track.time}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
