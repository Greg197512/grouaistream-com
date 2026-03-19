import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Share2, Users, X, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface DJSessionQRProps {
  onClose?: () => void;
}

export const DJSessionQR = ({ onClose }: DJSessionQRProps) => {
  const { user } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [guestCount, setGuestCount] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  const baseUrl = window.location.origin;

  // Create or fetch active session
  useEffect(() => {
    if (!user) return;
    fetchOrCreateSession();
  }, [user]);

  // Realtime guest count
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`session-guests-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dj_session_guests", filter: `session_id=eq.${session.id}` }, () => {
        fetchGuestCount();
      })
      .subscribe();
    fetchGuestCount();
    return () => { supabase.removeChannel(channel); };
  }, [session?.id]);

  const fetchGuestCount = async () => {
    if (!session) return;
    const { count } = await supabase
      .from("dj_session_guests")
      .select("*", { count: "exact", head: true })
      .eq("session_id", session.id);
    setGuestCount(count || 0);
  };

  const fetchOrCreateSession = async () => {
    if (!user) return;
    // Check for existing active session
    const { data: existing } = await supabase
      .from("dj_sessions")
      .select("*")
      .eq("host_user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (existing) {
      setSession(existing);
      return;
    }

    // Create new session
    setIsCreating(true);
    const { data: newSession, error } = await supabase
      .from("dj_sessions")
      .insert({ host_user_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error("Nie udało się utworzyć sesji");
      console.error(error);
    } else {
      setSession(newSession);
      toast.success("💀 Sesja DJ utworzona — skanuj QR!");
    }
    setIsCreating(false);
  };

  const partyUrl = session ? `${baseUrl}/party/${session.session_code}` : "";

  const copyLink = () => {
    navigator.clipboard.writeText(partyUrl);
    toast.success("🔗 Link skopiowany — dawaj na parkiet!");
  };

  const shareLink = async () => {
    if (navigator.share) {
      await navigator.share({ title: "🎧 DJ GrouAI — Dołącz na parkiet!", url: partyUrl });
    } else {
      copyLink();
    }
  };

  const endSession = async () => {
    if (!session) return;
    await supabase.from("dj_sessions").update({ is_active: false }).eq("id", session.id);
    setSession(null);
    toast.info("Sesja zakończona");
  };

  if (!user) {
    return (
      <div className="groove-card p-6 text-center">
        <QrCode className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Zaloguj się, aby utworzyć sesję DJ</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="groove-card p-6 relative overflow-hidden"
    >
      {/* Dark techno glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 via-transparent to-purple-900/10 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">DJ Pulpit — QR Session</h3>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {isCreating ? (
          <div className="text-center py-8">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
              <QrCode className="h-12 w-12 mx-auto text-primary" />
            </motion.div>
            <p className="mt-3 text-sm text-muted-foreground">Tworzenie sesji...</p>
          </div>
        ) : session ? (
          <div className="flex flex-col items-center gap-4">
            {/* QR Code */}
            <div className="bg-white p-4 rounded-2xl shadow-lg shadow-red-500/10">
              <QRCodeSVG
                value={partyUrl}
                size={200}
                level="H"
                bgColor="#FFFFFF"
                fgColor="#1a1a2e"
                imageSettings={{
                  src: "/logo-icon.png",
                  height: 36,
                  width: 36,
                  excavate: true,
                }}
              />
            </div>

            {/* Session info */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Kod sesji</p>
              <p className="font-mono text-2xl font-bold text-primary tracking-widest">{session.session_code}</p>
            </div>

            {/* Live guest count */}
            <div className="flex items-center gap-2 bg-secondary/50 px-4 py-2 rounded-full">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {guestCount} {guestCount === 1 ? "osoba" : "osób"} na parkiecie
              </span>
              {guestCount > 0 && (
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-red-500"
                >
                  🔴
                </motion.span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 w-full">
              <Button onClick={copyLink} variant="outline" className="flex-1 gap-2">
                <Copy className="h-4 w-4" />
                Kopiuj link
              </Button>
              <Button onClick={shareLink} className="flex-1 gap-2">
                <Share2 className="h-4 w-4" />
                Udostępnij
              </Button>
            </div>

            <Button onClick={endSession} variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              Zakończ sesję
            </Button>
          </div>
        ) : (
          <div className="text-center py-6">
            <Button onClick={fetchOrCreateSession} className="gap-2">
              <QrCode className="h-4 w-4" />
              Utwórz sesję DJ
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
