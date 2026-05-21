import { motion } from "framer-motion";
import { Users, MessageCircle, Heart, Trophy, TrendingUp, Star } from "lucide-react";
import { EmpireLayout } from "@/components/empire/EmpireLayout";

const POSTS = [
  {
    id: "1",
    author: "@FitCreator",
    avatar: "F",
    gradient: "from-orange-500 to-pink-600",
    time: "2 godz. temu",
    content: "Mój TikTok Fitness Agent wygenerował dziś 8 skryptów i publisher opublikował wszystkie automatycznie 🚀 Osiągnąłem 47k views w 24h!",
    likes: 124,
    comments: 23,
    achievement: "47k views w 24h",
  },
  {
    id: "2",
    author: "@NewsletterPro",
    avatar: "N",
    gradient: "from-teal-500 to-blue-600",
    time: "5 godz. temu",
    content: "Wskazówka dla początkujących: zacznij od Newsletter AI Pack. Mój pierwszy newsletter wysyłany przez agenta - 34% open rate! Bez kodowania.",
    likes: 89,
    comments: 15,
  },
  {
    id: "3",
    author: "@VideoEmpire",
    avatar: "V",
    gradient: "from-red-500 to-orange-600",
    time: "1 dzień temu",
    content: "Milestone! Moje imperium wygenerowało $1000 w pierwszym miesiącu 💰 6 agentów pracujących 24/7. To działa.",
    likes: 312,
    comments: 67,
    achievement: "$1000 w pierwszym miesiącu",
  },
];

const LEADERBOARD = [
  { rank: 1, name: "@VideoEmpire", score: "$4,200/mc", badge: "👑" },
  { rank: 2, name: "@FitCreator", score: "$2,800/mc", badge: "🥈" },
  { rank: 3, name: "@NewsletterPro", score: "$1,900/mc", badge: "🥉" },
  { rank: 4, name: "@PodcastAI", score: "$1,200/mc", badge: "" },
  { rank: 5, name: "@EcomMaster", score: "$980/mc", badge: "" },
];

export default function EmpireCommunity() {
  return (
    <EmpireLayout>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Users className="w-6 h-6 text-teal-400" />
          <h1 className="text-2xl font-bold text-white">Community</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Feed */}
          <div className="lg:col-span-2 space-y-4">
            {POSTS.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-9 h-9 rounded-full bg-gradient-to-br ${post.gradient} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}
                  >
                    {post.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{post.author}</p>
                    <p className="text-xs text-white/35">{post.time}</p>
                  </div>
                  {post.achievement && (
                    <div className="ml-auto flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-full px-3 py-1">
                      <Trophy className="w-3 h-3 text-yellow-400" />
                      <span className="text-xs text-yellow-400 font-medium">{post.achievement}</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-white/75 leading-relaxed mb-4">{post.content}</p>
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-1.5 text-xs text-white/40 hover:text-rose-400 transition-colors">
                    <Heart className="w-3.5 h-3.5" />
                    {post.likes}
                  </button>
                  <button className="flex items-center gap-1.5 text-xs text-white/40 hover:text-teal-400 transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" />
                    {post.comments}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Leaderboard */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <h2 className="text-sm font-semibold text-white">Top Budowniczowie</h2>
              </div>
              <div className="space-y-2.5">
                {LEADERBOARD.map((item) => (
                  <div key={item.rank} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white/30 w-4">
                      {item.badge || item.rank}
                    </span>
                    <span className="text-sm text-white/70 flex-1">{item.name}</span>
                    <span className="text-xs font-semibold text-emerald-400">{item.score}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-gradient-to-br from-teal-500/10 to-purple-500/10 border border-teal-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-teal-400" />
                <h2 className="text-sm font-semibold text-white">Społeczność</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">Aktywni budowniczowie</span>
                  <span className="text-sm font-bold text-white">2 847</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">Agent teams dziś</span>
                  <span className="text-sm font-bold text-teal-400">14 302</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">Łączny dochód społ.
</span>
                  <span className="text-sm font-bold text-emerald-400">$284k</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </EmpireLayout>
  );
}
