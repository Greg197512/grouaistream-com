import { motion } from "framer-motion";
import { ArtistCard } from "@/components/cards/ArtistCard";

const artists = [
  { id: "1", name: "Aurora Beats", followers: "2.4M", gradient: "from-pink-500 to-rose-500" },
  { id: "2", name: "Neon Wave", followers: "1.8M", gradient: "from-blue-500 to-cyan-500" },
  { id: "3", name: "Synthia", followers: "956K", gradient: "from-purple-500 to-pink-500" },
  { id: "4", name: "The Groove Masters", followers: "1.2M", gradient: "from-green-500 to-emerald-500" },
  { id: "5", name: "Sky Walker", followers: "734K", gradient: "from-orange-500 to-yellow-500" },
  { id: "6", name: "Beat Collective", followers: "1.5M", gradient: "from-indigo-500 to-blue-500" },
];

export const TopArtists = () => {
  return (
    <section className="px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-bold">Popular Artists</h2>
          <p className="text-sm text-muted-foreground mt-1">Based on your listening history</p>
        </div>
        <button className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
          Show all
        </button>
      </div>

      <motion.div 
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
          }
        }}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
      >
        {artists.map((artist) => (
          <motion.div
            key={artist.id}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
          >
            <ArtistCard
              name={artist.name}
              followers={artist.followers}
              gradient={artist.gradient}
            />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};
