import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useAssistantConfig = () => {
  const { user } = useAuth();
  const [assistantName, setAssistantName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsNaming, setNeedsNaming] = useState(false);

  useEffect(() => {
    if (!user) {
      setAssistantName(null);
      setNeedsNaming(false);
      setIsLoading(false);
      return;
    }
    loadConfig();
  }, [user]);

  const loadConfig = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("ai_assistant_config")
        .select("assistant_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setAssistantName(data.assistant_name);
        setNeedsNaming(false);
      } else {
        setNeedsNaming(true);
      }
    } catch (e) {
      console.error("Failed to load assistant config:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAssistantName = useCallback(async (name: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("ai_assistant_config")
        .upsert({ user_id: user.id, assistant_name: name }, { onConflict: "user_id" });
      
      if (!error) {
        setAssistantName(name);
        setNeedsNaming(false);
      }
    } catch (e) {
      console.error("Failed to save assistant name:", e);
    }
  }, [user]);

  return { assistantName, isLoading, needsNaming, saveAssistantName };
};
