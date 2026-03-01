import { useState, ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { PlayerBar } from "./PlayerBar";
import { TopBar } from "./TopBar";
import { AIAssistant } from "@/components/assistant/AIAssistant";

import { DragDropProvider } from "@/contexts/DragDropContext";
import { FloatingPlaylistDropZones } from "@/components/dnd/FloatingPlaylistDropZones";
import { AuroraBackground } from "@/components/effects/AuroraBackground";

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <DragDropProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background relative">
        {/* Aurora animated background */}
        <AuroraBackground />
        
        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <Sidebar 
            collapsed={sidebarCollapsed} 
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
          />

          {/* Content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <TopBar />
            <main className="flex-1 overflow-y-auto groove-scrollbar pb-28">
              {children}
            </main>
          </div>
        </div>

        {/* Floating Playlist Drop Zones */}
        <FloatingPlaylistDropZones />

        {/* Floating Draggable Player Bar */}
        <PlayerBar />

        {/* AI Assistant Floating Bubble */}
        <AIAssistant />
        
      </div>
    </DragDropProvider>
  );
};
