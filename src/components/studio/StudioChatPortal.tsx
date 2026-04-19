import { useState } from "react";
import { StudioChatSidebar } from "./StudioChatSidebar";

/**
 * Wrapper który zarządza stanem otwarcia sidebara.
 * Renderowany w Suno page — chat AI dostępny zawsze przez przycisk po prawej.
 */
export const StudioChatPortal = () => {
  const [isOpen, setIsOpen] = useState(false);
  return <StudioChatSidebar isOpen={isOpen} onToggle={() => setIsOpen((v) => !v)} />;
};
