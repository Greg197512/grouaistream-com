import { useState } from "react";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Palette,
  LogOut,
  Camera,
  Brain,
  Eye,
  Mic,
  Heart,
  Trash2,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.display_name || ""
  );
  const [saving, setSaving] = useState(false);

  // Privacy settings
  const [moodDetection, setMoodDetection] = useState(true);
  const [webcamAccess, setWebcamAccess] = useState(false);
  const [voiceAnalysis, setVoiceAnalysis] = useState(false);
  const [listeningHistory, setListeningHistory] = useState(true);
  const [personalizedAds, setPersonalizedAds] = useState(false);

  // Notification settings
  const [newReleases, setNewReleases] = useState(true);
  const [playlistUpdates, setPlaylistUpdates] = useState(true);
  const [aiRecommendations, setAiRecommendations] = useState(true);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Profile updated!");
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const handleDeleteHistory = async () => {
    if (!user) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete all your listening history? This cannot be undone."
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("listening_history")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Listening history deleted");
    } catch (error) {
      toast.error("Failed to delete history");
    }
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <MainLayout>
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <h1 className="font-display text-3xl font-bold">Settings</h1>
        </div>

        {/* Profile Section */}
        <section className="groove-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Profile</h2>
          </div>

          <div className="flex items-center gap-6 mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full groove-gradient-bg flex items-center justify-center text-2xl font-bold text-primary-foreground">
                {displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
              </div>
              <button className="absolute bottom-0 right-0 p-1.5 rounded-full bg-secondary border border-border hover:bg-muted transition-colors">
                <Camera className="h-3 w-3" />
              </button>
            </div>
            <div>
              <p className="font-medium">{displayName || "User"}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-2"
              />
            </div>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </section>

        {/* AI & Privacy Section */}
        <section className="groove-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">AI & Privacy</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Control how GrooveAI learns from your behavior. All data is anonymized and processed securely.
          </p>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Mood Detection</p>
                  <p className="text-sm text-muted-foreground">
                    AI analyzes listening patterns to detect mood
                  </p>
                </div>
              </div>
              <Switch checked={moodDetection} onCheckedChange={setMoodDetection} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Webcam Mood Analysis</p>
                  <p className="text-sm text-muted-foreground">
                    Use facial expressions for mood detection
                  </p>
                </div>
              </div>
              <Switch checked={webcamAccess} onCheckedChange={setWebcamAccess} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mic className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Voice Emotion Analysis</p>
                  <p className="text-sm text-muted-foreground">
                    Analyze voice for better recommendations
                  </p>
                </div>
              </div>
              <Switch checked={voiceAnalysis} onCheckedChange={setVoiceAnalysis} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Heart className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Listening History</p>
                  <p className="text-sm text-muted-foreground">
                    Track listening for personalization
                  </p>
                </div>
              </div>
              <Switch checked={listeningHistory} onCheckedChange={setListeningHistory} />
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="groove-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Notifications</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">New Releases</p>
                <p className="text-sm text-muted-foreground">
                  From artists you follow
                </p>
              </div>
              <Switch checked={newReleases} onCheckedChange={setNewReleases} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Playlist Updates</p>
                <p className="text-sm text-muted-foreground">
                  AI playlist changes and updates
                </p>
              </div>
              <Switch checked={playlistUpdates} onCheckedChange={setPlaylistUpdates} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">AI Recommendations</p>
                <p className="text-sm text-muted-foreground">
                  Personalized music suggestions
                </p>
              </div>
              <Switch checked={aiRecommendations} onCheckedChange={setAiRecommendations} />
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section className="groove-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Data Management</h2>
          </div>

          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={handleDeleteHistory}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete Listening History
            </Button>
            <p className="text-sm text-muted-foreground">
              GDPR compliant. Request full data export via email: privacy@grooveai.stream
            </p>
          </div>
        </section>

        {/* Legal & Compliance */}
        <section className="groove-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Legalność i zgodność z prawem</h2>
          </div>
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 mb-4">
            <p className="font-semibold text-primary text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              ✅ Wszystkie treści w GrouAI Stream są w pełni legalne
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Muzyka pochodzi z legalnych źródeł: Creative Commons (CC Mixter), oficjalne YouTube Embed API, 
              oraz treści przesłane przez użytkowników z odpowiednimi prawami. Działamy zgodnie z RODO, 
              Dyrektywą DSM 2019/790 oraz YouTube/Spotify API Terms of Service.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/legal")}
            className="gap-2 w-full"
          >
            <Shield className="h-4 w-4" />
            Regulamin, Polityka Prywatności, RODO i prawa autorskie
          </Button>
        </section>

        {/* Sign Out */}
        <Button
          variant="outline"
          onClick={handleSignOut}
          className="w-full gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </MainLayout>
  );
};

export default Settings;
