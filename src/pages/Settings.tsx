import { useState, useRef } from "react";
import {
  Settings as SettingsIcon, User, Bell, Shield, LogOut, Camera,
  Brain, Eye, Mic, Heart, Trash2, Loader2, Box
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionManager } from "@/components/settings/SubscriptionManager";
import { useEffects3D } from "@/contexts/Effects3DContext";

const Settings = () => {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const { is3D, setIs3D } = useEffects3D();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Privacy settings
  const [moodDetection, setMoodDetection] = useState(true);
  const [webcamAccess, setWebcamAccess] = useState(false);
  const [voiceAnalysis, setVoiceAnalysis] = useState(false);
  const [listeningHistory, setListeningHistory] = useState(true);

  // Notification settings
  const [newReleases, setNewReleases] = useState(true);
  const [playlistUpdates, setPlaylistUpdates] = useState(true);
  const [aiRecommendations, setAiRecommendations] = useState(true);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Add cache buster
      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: urlWithCacheBust }
      });

      if (updateError) throw updateError;

      // Update profiles table
      await supabase
        .from("profiles")
        .update({ avatar_url: urlWithCacheBust })
        .eq("user_id", user.id);

      setAvatarUrl(urlWithCacheBust);
      toast.success(t("settings.avatarUpdated"));
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast.error(t("settings.avatarError"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Update auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: displayName }
      });
      if (authError) throw authError;

      // Update profiles table
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success(t("settings.profileUpdated"));
    } catch (error) {
      console.error("Update error:", error);
      toast.error(t("settings.profileError"));
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success(t("settings.signOutSuccess"));
    navigate("/");
  };

  const handleDeleteHistory = async () => {
    if (!user) return;
    const confirmed = window.confirm(t("settings.deleteHistoryConfirm"));
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("listening_history")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success(t("settings.deleteHistorySuccess"));
    } catch (error) {
      toast.error(t("settings.deleteHistoryError"));
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
          <h1 className="font-display text-3xl font-bold">{t("settings.title")}</h1>
        </div>

        {/* Profile Section */}
        <section className="groove-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">{t("settings.profile")}</h2>
          </div>

          <div className="flex items-center gap-6 mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full groove-gradient-bg flex items-center justify-center text-2xl font-bold text-primary-foreground overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-secondary border border-border hover:bg-muted transition-colors"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div>
              <p className="font-medium">{displayName || "User"}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-primary hover:underline mt-1"
                disabled={uploadingAvatar}
              >
                {t("settings.changeAvatar")}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="displayName">{t("settings.displayName")}</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-2"
              />
            </div>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? t("settings.saving") : t("settings.saveChanges")}
            </Button>
          </div>
        </section>

        {/* Subscription Management */}
        <section className="groove-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Subskrypcja</h2>
          </div>
          <SubscriptionManager />
        </section>

        {/* Wygląd / Efekt 3D — działa też na telefonie (przełącznik dostępny bez menu bocznego) */}
        <section className="groove-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Box className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Wygląd</h2>
          </div>
          <div className="space-y-4">
            <SettingRow
              icon={Box}
              title="Efekt 3D"
              desc="Wypukłe kafelki i okładki, które żyją pod kursorem, a na telefonie reagują na przechył. Wyłącz, jeśli wolisz płasko lub chcesz oszczędzać baterię."
              checked={is3D}
              onChange={setIs3D}
            />
          </div>
        </section>

        {/* AI & Privacy Section */}
        <section className="groove-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">{t("settings.aiPrivacy")}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{t("settings.aiPrivacyDesc")}</p>

          <div className="space-y-4">
            <SettingRow icon={Brain} title={t("settings.moodDetection")} desc={t("settings.moodDetectionDesc")} checked={moodDetection} onChange={setMoodDetection} />
            <SettingRow icon={Eye} title={t("settings.webcamMood")} desc={t("settings.webcamMoodDesc")} checked={webcamAccess} onChange={setWebcamAccess} />
            <SettingRow icon={Mic} title={t("settings.voiceEmotion")} desc={t("settings.voiceEmotionDesc")} checked={voiceAnalysis} onChange={setVoiceAnalysis} />
            <SettingRow icon={Heart} title={t("settings.listeningHistory")} desc={t("settings.listeningHistoryDesc")} checked={listeningHistory} onChange={setListeningHistory} />
          </div>
        </section>

        {/* Notifications Section */}
        <section className="groove-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">{t("settings.notifications")}</h2>
          </div>
          <div className="space-y-4">
            <NotifRow title={t("settings.newReleases")} desc={t("settings.newReleasesDesc")} checked={newReleases} onChange={setNewReleases} />
            <NotifRow title={t("settings.playlistUpdates")} desc={t("settings.playlistUpdatesDesc")} checked={playlistUpdates} onChange={setPlaylistUpdates} />
            <NotifRow title={t("settings.aiRecommendations")} desc={t("settings.aiRecommendationsDesc")} checked={aiRecommendations} onChange={setAiRecommendations} />
          </div>
        </section>

        {/* Data Management */}
        <section className="groove-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">{t("settings.dataManagement")}</h2>
          </div>
          <div className="space-y-4">
            <Button variant="outline" onClick={handleDeleteHistory} className="gap-2 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
              {t("settings.deleteHistory")}
            </Button>
            <p className="text-sm text-muted-foreground">{t("settings.gdprCompliant")}</p>
          </div>
        </section>

        {/* Legal & Compliance */}
        <section className="groove-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">{t("settings.legalCompliance")}</h2>
          </div>
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 mb-4">
            <p className="font-semibold text-primary text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t("settings.legalBadge")}
            </p>
            <p className="text-xs text-muted-foreground mt-2">{t("settings.legalBadgeDesc")}</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/legal")} className="gap-2 w-full">
            <Shield className="h-4 w-4" />
            {t("settings.legalButton")}
          </Button>
        </section>

        {/* Sign Out */}
        <Button variant="outline" onClick={handleSignOut} className="w-full gap-2">
          <LogOut className="h-4 w-4" />
          {t("settings.signOut")}
        </Button>
      </div>
    </MainLayout>
  );
};

const SettingRow = ({ icon: Icon, title, desc, checked, onChange }: { icon: any; title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const NotifRow = ({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export default Settings;
