import { useState } from "react";
import { EmpireSidebar } from "./EmpireSidebar";
import { MuseChat } from "./MuseChat";
import { Sparkles } from "lucide-react";

interface EmpireLayoutProps {
  children: React.ReactNode;
}

export function EmpireLayout({ children }: EmpireLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [museChatOpen, setMuseChatOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <EmpireSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <div
        className={`transition-all duration-300 border-l border-white/10 overflow-hidden flex-shrink-0 ${
          museChatOpen ? "w-80" : "w-0"
        }`}
      >
        {museChatOpen && <MuseChat onClose={() => setMuseChatOpen(false)} />}
      </div>
      {!museChatOpen && (
        <button
          onClick={() => setMuseChatOpen(true)}
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full shadow-xl z-50 bg-gradient-to-br from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        >
          <Sparkles className="w-5 h-5 text-white" />
        </button>
      )}
    </div>
  );
}
