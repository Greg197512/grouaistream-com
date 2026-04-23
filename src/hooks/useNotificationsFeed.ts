import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type FeedItem = {
  id: string;
  ts: string; // ISO timestamp
  icon: "heart" | "coin" | "trophy" | "comment" | "blog" | "challenge" | "stream" | "tip" | "alert";
  title: string;
  body?: string;
  href?: string;
};

const STORAGE_KEY = "grouai:notifications:lastSeen";

const fmtMoney = (n: number) =>
  n >= 1 ? `€${n.toFixed(2)}` : `${(n * 100).toFixed(1)}¢`;

const since = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "teraz";
  if (d < 3600) return `${Math.floor(d / 60)} min`;
  if (d < 86400) return `${Math.floor(d / 3600)} h`;
  return `${Math.floor(d / 86400)} d`;
};

export const useNotificationsFeed = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastSeenRef = useRef<number>(
    Number(localStorage.getItem(STORAGE_KEY) || 0)
  );

  const fetchFeed = useCallback(async () => {
    if (!user) {
      setItems([]);
      setUnreadCount(0);
      return;
    }

    const sinceISO = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const all: FeedItem[] = [];

    // 1. Lajki na moich utworach (od innych userów)
    const { data: myTracks } = await supabase
      .from("tracks")
      .select("id,title")
      .eq("user_id", user.id);
    const myTrackIds = (myTracks || []).map((t: any) => t.id);
    const trackTitleById = new Map((myTracks || []).map((t: any) => [t.id, t.title]));

    if (myTrackIds.length > 0) {
      const { data: likes } = await supabase
        .from("liked_songs")
        .select("id, track_id, user_id, liked_at")
        .in("track_id", myTrackIds)
        .neq("user_id", user.id)
        .gte("liked_at", sinceISO)
        .order("liked_at", { ascending: false })
        .limit(15);

      (likes || []).forEach((l: any) => {
        all.push({
          id: `like-${l.id}`,
          ts: l.liked_at,
          icon: "heart",
          title: `Nowy lajk ❤️`,
          body: `Ktoś polubił „${trackTitleById.get(l.track_id) || "Twój utwór"}"`,
          href: "/my-tracks",
        });
      });
    }

    // 2. Zarobki (streamy, tipy, bonusy)
    const { data: earnings } = await supabase
      .from("creator_earnings")
      .select("id, amount, earning_type, description, created_at")
      .eq("user_id", user.id)
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(20);

    (earnings || []).forEach((e: any) => {
      const isTip = e.earning_type === "tip";
      const isBonus = e.earning_type === "bonus" || e.earning_type === "weekend_bonus";
      const isStream = e.earning_type === "stream";
      all.push({
        id: `earn-${e.id}`,
        ts: e.created_at,
        icon: isTip ? "tip" : isBonus ? "trophy" : isStream ? "stream" : "coin",
        title: isTip
          ? `Tip ${fmtMoney(Number(e.amount))} 💰`
          : isBonus
          ? `Bonus ${fmtMoney(Number(e.amount))} 🎁`
          : isStream
          ? `+${fmtMoney(Number(e.amount))} ze streamu`
          : `+${fmtMoney(Number(e.amount))}`,
        body: e.description || undefined,
        href: "/creator-earnings",
      });
    });

    // 3. Milestone bonuses
    const { data: milestones } = await supabase
      .from("creator_milestone_bonuses")
      .select("id, bonus_type, amount, granted_at")
      .eq("user_id", user.id)
      .gte("granted_at", sinceISO)
      .order("granted_at", { ascending: false })
      .limit(5);

    (milestones || []).forEach((m: any) => {
      all.push({
        id: `ms-${m.id}`,
        ts: m.granted_at,
        icon: "trophy",
        title: `Milestone +${fmtMoney(Number(m.amount))} 🏆`,
        body: `Osiągnięcie: ${m.bonus_type.replace(/_/g, " ")}`,
        href: "/creator-earnings",
      });
    });

    // 4. Nowe posty na blogu
    const { data: posts } = await supabase
      .from("seo_blog_posts")
      .select("id, slug, title, created_at")
      .eq("is_published", true)
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(5);

    (posts || []).forEach((p: any) => {
      all.push({
        id: `blog-${p.id}`,
        ts: p.created_at,
        icon: "blog",
        title: `Nowy artykuł 📝`,
        body: p.title,
        href: `/blog/${p.slug}`,
      });
    });

    // 5. Komentarze do blogu (ogólnie — pokazuje aktywność na blogu)
    const { data: comments } = await supabase
      .from("blog_comments")
      .select("id, post_id, content, created_at")
      .eq("is_hidden", false)
      .neq("user_id", user.id)
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(5);

    (comments || []).forEach((c: any) => {
      all.push({
        id: `cmt-${c.id}`,
        ts: c.created_at,
        icon: "comment",
        title: `Nowy komentarz na blogu 💬`,
        body: c.content.slice(0, 80) + (c.content.length > 80 ? "…" : ""),
        href: "/blog",
      });
    });

    // 6. Aktywne weekend challenge
    const { data: challenge } = await supabase.rpc("get_active_weekend_challenge");
    const ch = challenge as any;
    if (ch?.active && ch?.eligible) {
      all.push({
        id: `chal-${ch.id}`,
        ts: new Date().toISOString(),
        icon: "challenge",
        title: `Wyzwanie ukończone! 🎉`,
        body: `Odbierz ${fmtMoney(Number(ch.reward_amount))} za „${ch.title}"`,
        href: "/creator-earnings",
      });
    } else if (ch?.active && !ch?.claimed) {
      all.push({
        id: `chal-active-${ch.id}`,
        ts: new Date().toISOString(),
        icon: "challenge",
        title: `Weekend Challenge 🔥`,
        body: `${ch.title} — ${ch.progress}/${ch.target_count}`,
        href: "/creator-earnings",
      });
    }

    // Sort i unique
    all.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    const seen = new Set<string>();
    const unique = all.filter((x) => (seen.has(x.id) ? false : seen.add(x.id)));

    setItems(unique.slice(0, 30));

    const newest = unique[0]?.ts ? new Date(unique[0].ts).getTime() : 0;
    const unread = unique.filter((i) => new Date(i.ts).getTime() > lastSeenRef.current).length;
    setUnreadCount(unread);
  }, [user]);

  useEffect(() => {
    fetchFeed();
    if (!user) return;
    const iv = window.setInterval(fetchFeed, 30000);
    return () => window.clearInterval(iv);
  }, [fetchFeed, user]);

  const markAllSeen = useCallback(() => {
    const now = Date.now();
    lastSeenRef.current = now;
    localStorage.setItem(STORAGE_KEY, String(now));
    setUnreadCount(0);
  }, []);

  return { items, unreadCount, markAllSeen, since };
};
