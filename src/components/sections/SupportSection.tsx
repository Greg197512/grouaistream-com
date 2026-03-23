import { motion } from "framer-motion";
import { Heart, Coffee, Star, HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";

const supportLinks = [
  {
    name: "Buy Me a Coffee",
    icon: Coffee,
    url: "https://buymeacoffee.com/grouaistream",
    color: "from-yellow-500/20 to-amber-500/20",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
  },
  {
    name: "Patronite",
    icon: HandHeart,
    url: "https://patronite.pl/grouaistream",
    color: "from-red-500/20 to-pink-500/20",
    border: "border-red-500/30",
    text: "text-red-400",
  },
  {
    name: "Ko-fi",
    icon: Heart,
    url: "https://ko-fi.com/grouaistream",
    color: "from-sky-500/20 to-blue-500/20",
    border: "border-sky-500/30",
    text: "text-sky-400",
  },
];

export const SupportSection = () => {
  return (
    <section className="px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mx-auto max-w-2xl text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
          <Star className="h-3.5 w-3.5" />
          Support
        </div>

        <h2 className="text-xl md:text-2xl font-bold mb-2">
          Pomóż rozwijać uczciwą platformę AI
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Każda kawa = walka z bot-farmami i nowe funkcje. Dzięki! ☕
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {supportLinks.map((link) => (
            <motion.a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`inline-flex items-center gap-2 rounded-full border ${link.border} bg-gradient-to-r ${link.color} px-4 py-2 text-sm font-medium ${link.text} transition-all hover:shadow-lg`}
            >
              <link.icon className="h-4 w-4" />
              {link.name}
            </motion.a>
          ))}
        </div>
      </motion.div>
    </section>
  );
};
