import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, FolderKanban, Bot, FileText, MoreVertical, Play, Pause, Loader2 } from "lucide-react";
import { EmpireLayout } from "@/components/empire/EmpireLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Project {
  id: string;
  name: string;
  description: string | null;
  agent_count: number;
  content_count: number;
  status: "active" | "paused" | "draft";
  updated_at: string;
}

const STATUS_CONFIG = {
  active: { label: "Aktywny", dot: "bg-emerald-400 animate-pulse", text: "text-emerald-400" },
  paused: { label: "Wstrzymany", dot: "bg-yellow-400", text: "text-yellow-400" },
  draft: { label: "Szkic", dot: "bg-white/25", text: "text-white/40" },
};

const GRADIENTS = [
  "from-orange-500 to-pink-600",
  "from-teal-500 to-blue-600",
  "from-purple-500 to-violet-600",
  "from-red-500 to-orange-600",
  "from-green-500 to-teal-600",
  "from-blue-500 to-indigo-600",
];

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min temu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} godz. temu`;
  return `${Math.floor(hrs / 24)} dni temu`;
};

export default function EmpireProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await (supabase as any)
        .from("empire_projects")
        .select("id, name, description, agent_count, content_count, status, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      setProjects((data as Project[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const toggleStatus = async (id: string, current: string) => {
    const next = current === "active" ? "paused" : "active";
    setToggling(id);
    const { error } = await (supabase as any)
      .from("empire_projects")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: next as Project["status"] } : p))
      );
    }
    setToggling(null);
  };

  const activeCount = projects.filter((p) => p.status === "active").length;

  return (
    <EmpireLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <FolderKanban className="w-6 h-6 text-teal-400" />
              <h1 className="text-2xl font-bold text-white">Moje Projekty</h1>
            </div>
            <p className="text-white/45 text-sm">{activeCount} aktywnych projektów</p>
          </div>
          <Button
            onClick={() => navigate("/empire/agents")}
            className="bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-500 hover:to-purple-500 border-0 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nowy projekt
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <FolderKanban className="w-12 h-12 text-white/15 mx-auto mb-4" />
            <p className="text-white/40 text-sm mb-1">Brak projektów</p>
            <p className="text-white/25 text-xs">Utwórz swój pierwszy projekt, aby zacząć</p>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project, i) => {
              const cfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.draft;
              const gradient = GRADIENTS[i % GRADIENTS.length];
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white flex-shrink-0",
                        gradient
                      )}
                    >
                      <FolderKanban className="w-6 h-6" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-semibold text-white">{project.name}</h3>
                        <div className="flex items-center gap-1.5">
                          <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                          <span className={cn("text-xs font-medium", cfg.text)}>{cfg.label}</span>
                        </div>
                      </div>
                      {project.description && (
                        <p className="text-sm text-white/50 mb-3">{project.description}</p>
                      )}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-xs text-white/40">
                          <Bot className="w-3.5 h-3.5" />
                          {project.agent_count ?? 0} agentów
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-white/40">
                          <FileText className="w-3.5 h-3.5" />
                          {project.content_count ?? 0} treści
                        </div>
                        <div className="text-xs text-white/30">
                          Ostatnia aktywność: {timeAgo(project.updated_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleStatus(project.id, project.status)}
                        disabled={toggling === project.id}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors disabled:opacity-40"
                      >
                        {toggling === project.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : project.status === "active" ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => navigate("/empire/agents")}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </EmpireLayout>
  );
}
