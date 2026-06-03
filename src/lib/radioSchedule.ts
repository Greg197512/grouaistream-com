import { supabase } from "@/integrations/supabase/client";

export interface RadioConfigState {
  is_active: boolean;
  mode: string;
  started_at: string | null;
}

export interface RadioScheduleItem {
  id: string;
  position: number;
  item_type: string | null;
  custom_duration: number | null;
  track?: { duration: number | null } | null;
}

export interface CurrentRadioPosition<T extends RadioScheduleItem> {
  item: T;
  index: number;
  offset: number;
  elapsed: number;
  totalDuration: number;
}

export const RADIO_SCHEDULE_SELECT =
  "id, position, item_type, custom_title, custom_duration, custom_audio_url, lang, track:tracks(id, title, artist, duration, audio_url, cover_url, genre)";

export const getRadioItemDuration = (item: RadioScheduleItem) => {
  if ((item.item_type || "track") === "track") return item.track?.duration || 180;
  return item.custom_duration || 30;
};

export const fetchRadioSchedule = async <T = unknown>() => {
  const pageSize = 1000;
  const all: T[] = [];

  for (let from = 0; from < 10000; from += pageSize) {
    const { data, error } = await supabase
      .from("radio_schedule")
      .select(RADIO_SCHEDULE_SELECT)
      .order("position", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    all.push(...((data || []) as T[]));
    if (!data || data.length < pageSize) break;
  }

  return all;
};

export const resolveCurrentRadioPosition = <T extends RadioScheduleItem>(
  schedule: T[],
  config: RadioConfigState | null,
  nowMs = Date.now()
): CurrentRadioPosition<T> | null => {
  if (!config?.is_active || !config.started_at || schedule.length === 0) return null;

  const startedAt = new Date(config.started_at).getTime();
  if (!Number.isFinite(startedAt)) return null;

  const totalDuration = schedule.reduce((sum, item) => sum + getRadioItemDuration(item), 0);
  if (totalDuration <= 0) return null;

  let elapsed = (nowMs - startedAt) / 1000;
  if (config.mode === "24h") elapsed = ((elapsed % totalDuration) + totalDuration) % totalDuration;
  if (elapsed < 0) elapsed = 0;
  if (elapsed >= totalDuration) elapsed = totalDuration - 0.001;

  let cumulative = 0;
  for (let index = 0; index < schedule.length; index += 1) {
    const item = schedule[index];
    const duration = getRadioItemDuration(item);
    if (cumulative + duration > elapsed) {
      return { item, index, offset: Math.max(0, elapsed - cumulative), elapsed, totalDuration };
    }
    cumulative += duration;
  }

  return { item: schedule[schedule.length - 1], index: schedule.length - 1, offset: 0, elapsed, totalDuration };
};

export const resolveCurrentRadioScheduleId = <T extends RadioScheduleItem>(
  schedule: T[],
  config: RadioConfigState | null,
  nowMs = Date.now()
) => resolveCurrentRadioPosition(schedule, config, nowMs)?.item.id ?? null;

export const syncRadioCurrentSchedule = async (scheduleId: string | null) => {
  const rpcClient = supabase as typeof supabase & {
    rpc(
      fn: "set_radio_current_schedule",
      args: { _schedule_id: string | null }
    ): Promise<{ error: { message: string } | null }>;
  };
  const { error } = await rpcClient.rpc("set_radio_current_schedule", { _schedule_id: scheduleId });
  return error;
};