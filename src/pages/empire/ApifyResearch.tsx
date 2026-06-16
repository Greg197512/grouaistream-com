import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Globe, Play, Loader2, ExternalLink,
  TrendingUp, Youtube, Hash, AlertCircle,
  CheckCircle2, Copy,
} from "lucide-react";
import { EmpireLayout } from "@/components/empire/EmpireLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  runGoogleSearch,
  scrapeWebsite,
  scrapeTikTok,
  scrapeYouTube,
  type GoogleSearchResult,
  type ResearchResult,
  type TikTokResult,
  type YouTubeResult,
} from "@/services/apifyService";

type ResearchMode = "google" | "website" | "tiktok" | "youtube";
type ResultItem =
  | GoogleSearchResult
  | ResearchResult
  | TikTokResult
  | YouTubeResult;

interface ResearchJob {
  id: string;
  mode: ResearchMode;
  query: string;
  status: "running" | "done" | "error";
  results: ResultItem[];
  error?: string;
  duration?: number;
}

const MODES: {
  id: ResearchMode;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  color: string;
}[] = [
  {
    id: "google",
    label: "Google Search",
    icon: <Search className="w-4 h-4" />,
    placeholder: "np. trendy fitness TikTok 2026",
    color: "from-blue-500 to-cyan-600",
  },
  {
    id: "website",
    label: "Scrape Website",
    icon: <Globe className="w-4 h-4" />,
    placeholder: "https://example.com",
    color: "from-emerald-500 to-teal-600",
  },
  {
    id: "tiktok",
    label: "TikTok Hashtag",
    icon: <Hash className="w-4 h-4" />,
    placeholder: "np. fitness lub morningroutine",
    color: "from-pink-500 to-rose-600",
  },
  {
    id: "youtube",
    label: "YouTube Search",
    icon: <Youtube className="w-4 h-4" />,
    placeholder: "np. AI tutorial 2026",
    color: "from-red-500 to-orange-600",
  },
];

function GoogleCard({ item }: { item: GoogleSearchResult }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-semibold text-white leading-tight">{item.title}</p>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/30 hover:text-teal-400 flex-shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <p className="text-xs text-teal-400 mb-2 truncate">{item.url}</p>
      <p className="text-xs text-white/55 leading-relaxed">{item.description}</p>
    </div>
  );
}

function WebsiteCard({ item }: { item: ResearchResult }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-semibold text-white">{item.title}</p>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-teal-400">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <p
        className={cn("text-xs text-white/55 leading-relaxed", !expanded && "line-clamp-4")}
      >
        {item.text}
      </p>
      {item.text.length > 200 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-teal-400 hover:text-teal-300 mt-2"
        >
          {expanded ? "Zwiń" : "Rozwiń"}
        </button>
      )}
    </div>
  );
}

function TikTokCard({ item }: { item: TikTokResult }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-sm text-white/80 leading-relaxed mb-3 line-clamp-3">{item.text}</p>
      <div className="flex items-center gap-4 text-xs text-white/40">
        <span>👤 {item.authorMeta?.name}</span>
        <span>👁 {(item.playCount / 1000).toFixed(1)}k</span>
        <span>❤️ {(item.diggCount / 1000).toFixed(1)}k</span>
        <span>🔄 {item.shareCount}</span>
      </div>
    </div>
  );
}

function YouTubeCard({ item }: { item: YouTubeResult }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-semibold text-white leading-tight">{item.title}</p>
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-red-400">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
      <p className="text-xs text-white/40 mb-2">{item.channelName}</p>
      <div className="flex items-center gap-4 text-xs text-white/40">
        <span>👁 {(item.viewCount / 1000).toFixed(1)}k</span>
        <span>👍 {(item.likeCount / 1000).toFixed(1)}k</span>
        <span>📅 {item.publishedAt?.slice(0, 10)}</span>
      </div>
    </div>
  );
}

function JobCard({ job }: { job: ResearchJob }) {
  const mode = MODES.find((m) => m.id === job.mode)!;

  const copyAll = () => {
    const text = job.results
      .map((r) => {
        if (job.mode === "google") {
          const g = r as GoogleSearchResult;
          return `${g.title}\n${g.url}\n${g.description}`;
        }
        if (job.mode === "website") return (r as ResearchResult).text;
        if (job.mode === "tiktok") return (r as TikTokResult).text;
        if (job.mode === "youtube") {
          const y = r as YouTubeResult;
          return `${y.title} — ${y.channelName}`;
        }
        return "";
      })
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
    >
      {/* Job header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
        <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white", mode.color)}>
          {mode.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{job.query}</p>
          <p className="text-xs text-white/40">{mode.label}</p>
        </div>
        <div className="flex items-center gap-2">
          {job.status === "running" && (
            <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
          )}
          {job.status === "done" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/35">{job.results.length} wyników · {job.duration}s</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <button onClick={copyAll} className="text-white/30 hover:text-teal-400 transition-colors" title="Kopiuj wszystko">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          )}
          {job.status === "error" && (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
        </div>
      </div>

      {/* Results */}
      {job.status === "running" && (
        <div className="px-5 py-8 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
          <span className="text-sm text-white/50">Apify Actor działa…</span>
        </div>
      )}

      {job.status === "error" && (
        <div className="px-5 py-5">
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{job.error}</p>
          </div>
        </div>
      )}

      {job.status === "done" && job.results.length > 0 && (
        <div className="px-5 py-4 space-y-3 max-h-[480px] overflow-y-auto">
          {job.results.map((r, i) => (
            <div key={i}>
              {job.mode === "google" && <GoogleCard item={r as GoogleSearchResult} />}
              {job.mode === "website" && <WebsiteCard item={r as ResearchResult} />}
              {job.mode === "tiktok" && <TikTokCard item={r as TikTokResult} />}
              {job.mode === "youtube" && <YouTubeCard item={r as YouTubeResult} />}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function ApifyResearch() {
  const [mode, setMode] = useState<ResearchMode>("google");
  const [query, setQuery] = useState("");
  const [maxItems, setMaxItems] = useState(10);
  const [jobs, setJobs] = useState<ResearchJob[]>([]);

  const currentMode = MODES.find((m) => m.id === mode)!;

  const run = async () => {
    if (!query.trim()) return;
    const job: ResearchJob = {
      id: Date.now().toString(),
      mode,
      query: query.trim(),
      status: "running",
      results: [],
    };
    setJobs((prev) => [job, ...prev]);
    setQuery("");
    const start = Date.now();
    try {
      let results: ResultItem[] = [];
      if (mode === "google") results = await runGoogleSearch(query.trim(), maxItems);
      else if (mode === "website") results = await scrapeWebsite(query.trim());
      else if (mode === "tiktok") results = await scrapeTikTok(query.trim(), maxItems);
      else if (mode === "youtube") results = await scrapeYouTube(query.trim(), maxItems);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? { ...j, status: "done", results, duration: Math.round((Date.now() - start) / 1000) }
            : j
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nieznany błąd";
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: "error", error: msg } : j))
      );
    }
  };

  return (
    <EmpireLayout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Research Agent</h1>
            <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full px-2 py-0.5 font-medium">
              Apify
            </span>
          </div>
          <p className="text-white/45 text-sm">
            Automatyczny research z Google, stron WWW, TikToka i YouTube
          </p>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
                mode === m.id
                  ? `bg-gradient-to-r ${m.color} text-white border-transparent shadow-lg`
                  : "bg-white/5 text-white/55 border-white/10 hover:text-white/80 hover:bg-white/10"
              )}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        {/* Query input */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1 flex items-center gap-3 bg-white/5 border border-white/15 rounded-2xl px-4 py-3 focus-within:border-teal-500/40 transition-colors">
            <div className={cn("w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center text-white flex-shrink-0", currentMode.color)}>
              {currentMode.icon}
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder={currentMode.placeholder}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
            />
          </div>
          <Button
            onClick={run}
            disabled={!query.trim() || jobs.some((j) => j.status === "running")}
            className="bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-500 hover:to-purple-500 border-0 text-white px-6"
          >
            <Play className="w-4 h-4 mr-2" />
            Start
          </Button>
        </div>

        {/* Max items */}
        <div className="flex items-center gap-3 mb-8">
          <span className="text-xs text-white/40">Max wyników:</span>
          {[5, 10, 20, 50].map((n) => (
            <button
              key={n}
              onClick={() => setMaxItems(n)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-lg transition-colors",
                maxItems === n
                  ? "bg-teal-600 text-white"
                  : "bg-white/5 text-white/40 hover:text-white/70"
              )}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Jobs */}
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-pink-600/20 border border-orange-500/20 flex items-center justify-center mb-4">
              <TrendingUp className="w-8 h-8 text-orange-400" />
            </div>
            <p className="text-white/40 text-sm mb-1">Research Agent gotowy</p>
            <p className="text-white/25 text-xs">
              Wybierz źródło, wpisz zapytanie i kliknij Start
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </EmpireLayout>
  );
}
