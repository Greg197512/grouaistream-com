import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, FolderKanban, Bot, FileText, MoreVertical, Play, Pause, Trash2 } from "lucide-react";
import { EmpireLayout } from "@/components/empire/EmpireLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Project {
  id: string;
  name: string;
  description: string;
  agents: number;
  content: number;
  status: "active" | "paused" | "draft";
  gradient: string;
  lastActivity: string;
}

const PROJECTS: Project[] = [
  {
    id: "1",
    name: "TikTok Fitness Empire",
    description: "Automatyczny content fitness na TikTok - skrypty, wideo, publikacja",
    agents: 4,
    content: 47,
    status: "active",
    gradient: "from-orange-500 to-pink-600",
    lastActivity: "2 min temu",
  },
  {
    id: "2",
    name: "Newsletter AI PL",
    description: "Tygodniowy newsletter o AI w języku polskim - automatyczny research i pisanie",
    agents: 3,
    content: 12,
    status: "active",
    gradient: "from-teal-500 to-blue-600",
    lastActivity: "1 godz. temu",
  },
  {
    id: "3",
    name: "Podcast Empire",
    description: "Generowanie odcinków podcastu z syntezą głosu ElevenLabs",
    agents: 3,
    content: 5,
    status: "paused",
    gradient: "from-purple-500 to-violet-600",
    lastActivity: "3 dni temu",
  },
  {
    id: "4",
    name: "YouTube Shorts Engine",
    description: "Automatyczne krótkie filmy na YouTube z trendy tematami",
    agents: 5,
    content: 0,
    status: "draft",
    gradient: "from-red-500 to-orange-600",
    lastActivity: "Nigdy",
  },
];

const STATUS_CONFIG = {
  active: { label: "Aktywny", dot: "bg-emerald-400 animate-pulse", text: "text-emerald-400" },
  paused: { label: "Wstrzymany", dot: "bg-yellow-400", text: "text-yellow-400" },
  draft: { label: "Szkic", dot: "bg-white/25", text: "text-white/40" },
};

export default function EmpireProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState(PROJECTS);

  const toggleStatus = (id: string) =>
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: p.status === "active" ? "paused" : "active" }
          : p
      )
    );

  return (
    <EmpireLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <FolderKanban className="w-6 h-6 text-teal-400" />
              <h1 className="text-2xl font-bold text-white">Moje Projekty</h1>
            </div>
            <p className="text-white/45 text-sm">{projects.filter((p) => p.status === "active").length} aktywnych projektów</p>
          </div>
          <Button
            onClick={() => navigate("/empire/agents")}
            className="bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-500 hover:to-purple-500 border-0 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nowy projekt
          </Button>
        </div>

        <div className="space-y-4">
          {projects.map((project, i) => {
            const cfg = STATUS_CONFIG[project.status];
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
                      project.gradient
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
                    <p className="text-sm text-white/50 mb-3">{project.description}</p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-xs text-white/40">
                        <Bot className="w-3.5 h-3.5" />
                        {project.agents} agentów
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-white/40">
                        <FileText className="w-3.5 h-3.5" />
                        {project.content} treści
                      </div>
                      <div className="text-xs text-white/30">
                        Ostatnia aktywność: {project.lastActivity}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleStatus(project.id)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    >
                      {project.status === "active" ? (
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
      </div>
    </EmpireLayout>
  );
}
