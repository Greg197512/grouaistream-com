import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TipWallet {
  balance: number;
  total_received: number;
  total_sent: number;
  welcome_seen: boolean;
}

export const useTipWallet = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<TipWallet | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setWallet(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("get_tip_wallet");
    if (!error && data && !(data as any).error) {
      setWallet(data as unknown as TipWallet);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markWelcomeSeen = useCallback(async () => {
    await supabase.rpc("mark_tip_welcome_seen");
    setWallet((w) => (w ? { ...w, welcome_seen: true } : w));
  }, []);

  return { wallet, loading, refresh, markWelcomeSeen };
};
