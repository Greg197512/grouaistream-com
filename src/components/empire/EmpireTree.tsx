import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Folder, FileText, Video, Mic, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface TreeNode {
  id: string;
  label: string;
  type: "project" | "agent" | "content" | "video" | "audio" | "web";
  children?: TreeNode[];
  status?: "active" | "done" | "idle";
}

const ICON_MAP = {
  project: Folder,
  agent: () => <span className="text-[14px]">&#129302;</span>,
  content: FileText,
  video: Video,
  audio: Mic,
  web: Globe,
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-teal-400 animate-pulse",
  done: "bg-emerald-400",
  idle: "bg-white/20",
};

const EMPIRE_DATA: TreeNode[] = [
  {
    id: "1",
    label: "TikTok Fitness Empire 💪",
    type: "project",
    status: "active",
    children: [
      {
        id: "1-1",
        label: "Content Crew",
        type: "agent",
        status: "active",
        children: [
          { id: "1-1-1", label: "Skrypt #47 - Morning Routine", type: "content", status: "done" },
          { id: "1-1-2", label: "Skrypt #48 - 30-Day Challenge", type: "content", status: "active" },
        ],
      },
      {
        id: "1-2",
        label: "Video Producer",
        type: "agent",
        status: "done",
        children: [
          { id: "1-2-1", label: "Video #12 - Montag Workout", type: "video", status: "done" },
        ],
      },
    ],
  },
  {
    id: "2",
    label: "Newsletter AI PL 📬",
    type: "project",
    status: "active",
    children: [
      {
        id: "2-1",
        label: "Research Agent",
        type: "agent",
        status: "active",
        children: [
          { id: "2-1-1", label: "Artykuł: AI w 2026", type: "content", status: "active" },
        ],
      },
    ],
  },
  {
    id: "3",
    label: "Podcast Empire 🎧",
    type: "project",
    status: "idle",
    children: [
      { id: "3-1", label: "Audio Writer", type: "agent", status: "idle" },
    ],
  },
];

function TreeNodeItem({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;
  const Icon = ICON_MAP[node.type] as React.ElementType;

  return (
    <div>
      <button
        onClick={() => hasChildren && setOpen(!open)}
        className={cn(
          "flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg transition-colors text-sm group",
          hasChildren
            ? "hover:bg-white/5 cursor-pointer"
            : "cursor-default",
          depth === 0 ? "font-semibold text-white" : "text-white/65 hover:text-white/90"
        )}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {hasChildren && (
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 text-white/30 transition-transform flex-shrink-0",
              open && "rotate-90"
            )}
          />
        )}
        {!hasChildren && <span className="w-3.5" />}
        <Icon className="w-4 h-4 flex-shrink-0 text-white/50" />
        <span className="flex-1 truncate">{node.label}</span>
        {node.status && (
          <span
            className={cn(
              "w-2 h-2 rounded-full flex-shrink-0",
              STATUS_DOT[node.status]
            )}
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {node.children!.map((child) => (
              <TreeNodeItem key={child.id} node={child} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function EmpireTree() {
  return (
    <div className="space-y-0.5">
      {EMPIRE_DATA.map((node) => (
        <TreeNodeItem key={node.id} node={node} />
      ))}
    </div>
  );
}
