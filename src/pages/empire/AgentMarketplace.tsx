import { useState } from "react";
import { motion } from "framer-motion";
import {
  Star, ShoppingBag, Search, Filter, Play,
  TrendingUp, Users, Zap, CheckCircle,
} from "lucide-react";
import { EmpireLayout } from "@/components/empire/EmpireLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MarketItem {
  id: string;
  name: string;
  creator: string;
  category: string;
  rating: number;
  reviews: number;
  price: number;
  credits: number;
  agents: string[];
  income: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  tags: string[];
  gradient: string;
  installed?: boolean;
}

const ITEMS: MarketItem[] = [
  {
    id: "1",
    name: "TikTok Fitness Empire Pack",
    creator: "@FitCreator",
    category: "Fitness",
    rating: 4.9,
    reviews: 234,
    price: 29,
    credits: 0,
    agents: ["Researcher", "Script Writer", "Video Producer", "Publisher"],
    income: "$200-800/mc",
    difficulty: "Beginner",
    tags: ["tiktok", "fitness", "video"],
    gradient: "from-orange-500 to-pink-600",
    installed: true,
  },
  {
    id: "2",
    name: "Newsletter AI PL Pro",
    creator: "@NewsletterGuru",
    category: "Newsletter",
    rating: 4.8,
    reviews: 189,
    price: 0,
    credits: 200,
    agents: ["Researcher", "Writer", "Formatter", "Publisher"],
    income: "$100-500/mc",
    difficulty: "Beginner",
    tags: ["newsletter", "email", "pl"],
    gradient: "from-teal-500 to-blue-600",
  },
  {
    id: "3",
    name: "YouTube Shorts Engine v2",
    creator: "@VideoEmpire",
    category: "YouTube",
    rating: 4.7,
    reviews: 156,
    price: 49,
    credits: 0,
    agents: ["Trend Researcher", "Script Writer", "Video Editor", "SEO Optimizer", "Publisher"],
    income: "$500-2000/mc",
    difficulty: "Intermediate",
    tags: ["youtube", "shorts", "video"],
    gradient: "from-red-500 to-orange-600",
  },
  {
    id: "4",
    name: "Podcast Generator Pro",
    creator: "@PodcastAI",
    category: "Podcast",
    rating: 4.6,
    reviews: 98,
    price: 39,
    credits: 0,
    agents: ["Researcher", "Writer", "Voice Artist", "Publisher"],
    income: "$150-600/mc",
    difficulty: "Intermediate",
    tags: ["podcast", "audio", "voice"],
    gradient: "from-purple-500 to-violet-600",
  },
  {
    id: "5",
    name: "LinkedIn Thought Leader",
    creator: "@LinkedInAI",
    category: "LinkedIn",
    rating: 4.8,
    reviews: 312,
    price: 0,
    credits: 150,
    agents: ["Trend Researcher", "Writer", "Publisher"],
    income: "$300-1200/mc",
    difficulty: "Beginner",
    tags: ["linkedin", "b2b", "content"],
    gradient: "from-blue-600 to-cyan-600",
  },
  {
    id: "6",
    name: "E-commerce Product Content",
    creator: "@EcomAI",
    category: "E-commerce",
    rating: 4.5,
    reviews: 74,
    price: 59,
    credits: 0,
    agents: ["Product Researcher", "Description Writer", "SEO Agent", "Publisher"],
    income: "$400-1500/mc",
    difficulty: "Advanced",
    tags: ["ecommerce", "shopify", "seo"],
    gradient: "from-emerald-500 to-teal-600",
  },
];

const CATEGORIES = ["Wszystkie", "Fitness", "Newsletter", "YouTube", "Podcast", "LinkedIn", "E-commerce"];
const DIFFICULTIES = ["Wszystkie", "Beginner", "Intermediate", "Advanced"];

export default function AgentMarketplace() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Wszystkie");
  const [difficulty, setDifficulty] = useState("Wszystkie");
  const [items, setItems] = useState(ITEMS);
  const [preview, setPreview] = useState<MarketItem | null>(null);

  const install = (id: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, installed: true } : i)));

  const filtered = items.filter((item) => {
    const matchSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.tags.some((t) => t.includes(search.toLowerCase()));
    const matchCat = category === "Wszystkie" || item.category === category;
    const matchDiff = difficulty === "Wszystkie" || item.difficulty === difficulty;
    return matchSearch && matchCat && matchDiff;
  });

  const diffColor: Record<string, string> = {
    Beginner: "text-emerald-400 bg-emerald-400/10",
    Intermediate: "text-yellow-400 bg-yellow-400/10",
    Advanced: "text-red-400 bg-red-400/10",
  };

  return (
    <EmpireLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="w-6 h-6 text-teal-400" />
            <h1 className="text-2xl font-bold text-white">Marketplace Agentów</h1>
          </div>
          <p className="text-white/45 text-sm">Gotowe przepływy agentowe od społeczności. Zainstaluj i zarabiaj.</p>
        </div>

        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 flex-1 min-w-48">
            <Search className="w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj agent teamów…"
              className="bg-transparent text-sm text-white/80 placeholder:text-white/30 outline-none flex-1"
            />
          </div>
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-lg transition-colors",
                  category === cat
                    ? "bg-teal-600 text-white"
                    : "text-white/50 hover:text-white/80"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/70 outline-none"
          >
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all group"
            >
              {/* Top gradient bar */}
              <div className={cn("h-1.5 bg-gradient-to-r", item.gradient)} />

              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-tight mb-1">{item.name}</h3>
                    <p className="text-xs text-white/40">{item.creator}</p>
                  </div>
                  {item.installed && (
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  )}
                </div>

                {/* Agents */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {item.agents.map((agent) => (
                    <span key={agent} className="text-[10px] bg-white/8 text-white/50 rounded px-1.5 py-0.5">
                      {agent}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
                      <span className="text-xs font-semibold text-white">{item.rating}</span>
                    </div>
                    <p className="text-[10px] text-white/35">{item.reviews} ocen</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-emerald-400 mb-0.5">{item.income}</p>
                    <p className="text-[10px] text-white/35">Est. dochód</p>
                  </div>
                  <div className="text-center">
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", diffColor[item.difficulty])}>
                      {item.difficulty}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreview(item)}
                    className="flex items-center gap-1.5 text-xs text-white/50 hover:text-teal-400 transition-colors"
                  >
                    <Play className="w-3 h-3" /> Demo
                  </button>
                  <div className="flex-1" />
                  {item.installed ? (
                    <span className="text-xs text-emerald-400 font-medium">Zainstalowany</span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => install(item.id)}
                      className={cn(
                        "text-xs h-8 px-4 border-0 text-white",
                        `bg-gradient-to-r ${item.gradient} hover:opacity-90`
                      )}
                    >
                      {item.price === 0
                        ? `${item.credits} kredytów`
                        : `$${item.price}`}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </EmpireLayout>
  );
}
