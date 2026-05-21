import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Save, Plus, ArrowRight, Settings2, Trash2,
  Search, Zap, FileText, Video, Mic, Globe, Bot, ChevronRight,
} from "lucide-react";
import { EmpireLayout } from "@/components/empire/EmpireLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AgentNode {
  id: string;
  name: string;
  role: string;
  icon: React.ReactNode;
  color: string;
  status?: "idle" | "running" | "done";
}

const NODE_LIBRARY = [
  { role: "Researcher", icon: <Search className="w-4 h-4" />, color: "from-blue-500 to-cyan-600", desc: "Zbiera dane, artykuły, trendy" },
  { role: "Writer", icon: <FileText className="w-4 h-4" />, color: "from-teal-500 to-emerald-600", desc: "Tworzy skrypty i artykuły" },
  { role: "Video Producer", icon: <Video className="w-4 h-4" />, color: "from-orange-500 to-red-600", desc: "Montaż i generowanie wideo" },
  { role: "Voice Artist", icon: <Mic className="w-4 h-4" />, color: "from-pink-500 to-rose-600", desc: "Synteza głosu ElevenLabs" },
  { role: "Publisher", icon: <Globe className="w-4 h-4" />, color: "from-purple-500 to-violet-600", desc: "Publikuje na platformach" },
  { role: "Optimizer", icon: <Zap className="w-4 h-4" />, color: "from-yellow-500 to-orange-600", desc: "SEO i optymalizacja treści" },
];

const TEMPLATES = [
  { name: "TikTok Fitness Empire", nodes: ["Researcher", "Writer", "Video Producer", "Publisher"], color: "from-orange-500 to-pink-600" },
  { name: "Newsletter AI PL", nodes: ["Researcher", "Writer", "Publisher"], color: "from-teal-500 to-blue-600" },
  { name: "Podcast Generator", nodes: ["Researcher", "Writer", "Voice Artist", "Publisher"], color: "from-purple-500 to-violet-600" },
  { name: "YouTube Shorts Engine", nodes: ["Researcher", "Writer", "Video Producer", "Optimizer", "Publisher"], color: "from-red-500 to-orange-600" },
];

let nodeCounter = 0;

export default function AgentBuilder() {
  const [nodes, setNodes] = useState<AgentNode[]>([
    { id: "n1", name: "Researcher #1", role: "Researcher", icon: <Search className="w-4 h-4" />, color: "from-blue-500 to-cyan-600", status: "done" },
    { id: "n2", name: "Writer #1", role: "Writer", icon: <FileText className="w-4 h-4" />, color: "from-teal-500 to-emerald-600", status: "running" },
    { id: "n3", name: "Publisher #1", role: "Publisher", icon: <Globe className="w-4 h-4" />, color: "from-purple-500 to-violet-600", status: "idle" },
  ]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"library" | "templates">("library");
  const [running, setRunning] = useState(false);
  const [teamName, setTeamName] = useState("Content Crew #1");

  const addNode = (libItem: (typeof NODE_LIBRARY)[0]) => {
    nodeCounter += 1;
    const newNode: AgentNode = {
      id: `n${Date.now()}`,
      name: `${libItem.role} #${nodeCounter + 3}`,
      role: libItem.role,
      icon: libItem.icon,
      color: libItem.color,
      status: "idle",
    };
    setNodes((n) => [...n, newNode]);
  };

  const removeNode = (id: string) => {
    setNodes((n) => n.filter((node) => node.id !== id));
    if (selectedNode === id) setSelectedNode(null);
  };

  const loadTemplate = (template: (typeof TEMPLATES)[0]) => {
    const newNodes: AgentNode[] = template.nodes.map((role, i) => {
      const lib = NODE_LIBRARY.find((l) => l.role === role)!;
      return {
        id: `t${i}${Date.now()}`,
        name: `${role} #1`,
        role,
        icon: lib.icon,
        color: lib.color,
        status: "idle" as const,
      };
    });
    setNodes(newNodes);
    setSelectedNode(null);
  };

  const runCrew = async () => {
    setRunning(true);
    for (let i = 0; i < nodes.length; i++) {
      setNodes((prev) =>
        prev.map((n, idx) =>
          idx === i ? { ...n, status: "running" } : n
        )
      );
      await new Promise((r) => setTimeout(r, 1200));
      setNodes((prev) =>
        prev.map((n, idx) =>
          idx === i ? { ...n, status: "done" } : n
        )
      );
    }
    setRunning(false);
  };

  const selected = nodes.find((n) => n.id === selectedNode);

  return (
    <EmpireLayout>
      <div className="h-full flex flex-col">
        {/* Top bar */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-white/8 bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-teal-400" />
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="bg-transparent text-base font-semibold text-white outline-none border-b border-transparent focus:border-teal-500/50 transition-colors pb-0.5"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 text-white/70 hover:text-white bg-transparent"
            >
              <Save className="w-4 h-4 mr-1.5" />
              Zapisz
            </Button>
            <Button
              size="sm"
              disabled={running || nodes.length === 0}
              onClick={runCrew}
              className="bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-500 hover:to-purple-500 border-0 text-white"
            >
              <Play className="w-4 h-4 mr-1.5" />
              {running ? "Uruchomiono…" : "Uruchom Crew"}
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel - library */}
          <div className="w-64 border-r border-white/8 bg-black/30 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-white/8">
              {(["library", "templates"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 py-3 text-xs font-medium transition-colors",
                    activeTab === tab
                      ? "text-teal-400 border-b-2 border-teal-400"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  {tab === "library" ? "Biblioteka" : "Szablony"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {activeTab === "library" &&
                NODE_LIBRARY.map((item) => (
                  <button
                    key={item.role}
                    onClick={() => addNode(item)}
                    className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl p-3 text-left transition-all group"
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br text-white flex-shrink-0",
                        item.color
                      )}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{item.role}</p>
                      <p className="text-xs text-white/40 truncate">{item.desc}</p>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-white/30 group-hover:text-teal-400 flex-shrink-0 ml-auto transition-colors" />
                  </button>
                ))}

              {activeTab === "templates" &&
                TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.name}
                    onClick={() => loadTemplate(tmpl)}
                    className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl p-3 transition-all group"
                  >
                    <div
                      className={cn(
                        "text-xs font-bold text-white mb-1.5 bg-gradient-to-r bg-clip-text text-transparent",
                        tmpl.color
                      )}
                    >
                      {tmpl.name}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {tmpl.nodes.map((n) => (
                        <span
                          key={n}
                          className="text-[10px] bg-white/10 text-white/60 rounded px-1.5 py-0.5"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto p-8 bg-[radial-gradient(ellipse_at_center,rgba(13,148,136,0.04)_0%,transparent_70%)]">
            <div className="min-w-max">
              {nodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Bot className="w-12 h-12 text-white/15 mb-4" />
                  <p className="text-white/40 text-sm mb-2">Canvas jest pusty</p>
                  <p className="text-white/25 text-xs">Dodaj agenty z biblioteki lub wybierz szablon</p>
                </div>
              ) : (
                <div className="flex items-start gap-2 pt-8">
                  {nodes.map((node, idx) => (
                    <div key={node.id} className="flex items-center gap-2">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.25 }}
                        onClick={() => setSelectedNode(node.id === selectedNode ? null : node.id)}
                        className={cn(
                          "w-44 rounded-2xl border cursor-pointer transition-all",
                          node.id === selectedNode
                            ? "border-teal-500/60 shadow-lg shadow-teal-500/20"
                            : "border-white/15 hover:border-white/30",
                          node.status === "running" && "ring-1 ring-teal-500/50 animate-pulse",
                          "bg-white/5"
                        )}
                      >
                        <div className={cn("h-1.5 rounded-t-2xl bg-gradient-to-r", node.color)} />
                        <div className="p-4">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white mb-3",
                              node.color
                            )}
                          >
                            {node.icon}
                          </div>
                          <p className="text-sm font-semibold text-white mb-0.5 leading-tight">{node.name}</p>
                          <p className="text-xs text-white/40 mb-3">{node.role}</p>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "w-2 h-2 rounded-full",
                                node.status === "done"
                                  ? "bg-emerald-400"
                                  : node.status === "running"
                                  ? "bg-teal-400 animate-pulse"
                                  : "bg-white/20"
                              )}
                            />
                            <span className="text-[11px] text-white/40">
                              {node.status === "done" ? "Gotowy" : node.status === "running" ? "Aktywny" : "Oczekuje"}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
                              className="ml-auto text-white/20 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                      {idx < nodes.length - 1 && (
                        <div className="flex items-center gap-1 text-white/25">
                          <div className="w-6 h-px bg-white/15" />
                          <ArrowRight className="w-4 h-4" />
                          <div className="w-6 h-px bg-white/15" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right panel - node config */}
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 260, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-l border-white/8 bg-black/30 overflow-hidden flex-shrink-0"
              >
                <div className="w-64 p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <Settings2 className="w-4 h-4 text-teal-400" />
                    <span className="text-sm font-semibold text-white">Konfiguracja</span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Nazwa agenta</label>
                      <input
                        value={selected.name}
                        onChange={(e) =>
                          setNodes((prev) =>
                            prev.map((n) =>
                              n.id === selected.id ? { ...n, name: e.target.value } : n
                            )
                          )
                        }
                        className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Rola</label>
                      <div className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white/60">
                        {selected.role}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Model AI</label>
                      <select className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white/80 outline-none">
                        <option value="claude">Claude 3.5 Sonnet</option>
                        <option value="gpt4o">GPT-4o</option>
                        <option value="grok">Grok 3</option>
                        <option value="gemini">Gemini 2.0</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Instrukcja systemowa</label>
                      <textarea
                        rows={4}
                        placeholder="Np. Jesteś ekspertem fitness. Pisz po polsku..."
                        className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-teal-500/50 resize-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/50 mb-2 block">Human-in-the-loop</label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div className="relative">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-9 h-5 bg-white/10 rounded-full peer-checked:bg-teal-600 transition-colors" />
                          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                        </div>
                        <span className="text-xs text-white/60">Wymaga akceptacji</span>
                      </label>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </EmpireLayout>
  );
}
