/**
 * stop-aging-sync — punkt wejścia danych z urządzeń i platform zdrowotnych.
 *
 * Jedna funkcja obsługuje dwa tryby:
 *  1. WEBHOOK (push od dostawcy: Garmin, Oura, WHOOP, Fitbit, Polar, Strava) —
 *     żądanie zawiera nagłówek podpisu i identyfikator użytkownika dostawcy,
 *     który mapujemy na konto przez tabelę `longevity_device_links`.
 *  2. PUSH Z APLIKACJI MOBILNEJ (Apple Health, Health Connect) — żądanie
 *     z tokenem JWT użytkownika; dane są już znormalizowane po stronie klienta.
 *
 * Rola funkcji jest wąska i celowa: NORMALIZACJA I SCALENIE. Żadne wskaźniki
 * (wiek biologiczny, stres, regeneracja) nie są tu liczone — robi to silnik
 * po stronie klienta, z tego samego kodu, który pokrywają testy jednostkowe.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-provider-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DataSource =
  | "garmin"
  | "oura"
  | "whoop"
  | "fitbit"
  | "polar"
  | "strava"
  | "apple_health"
  | "health_connect"
  | "withings"
  | "manual";

/** Ten sam kształt, co `DailyRecord` w `src/lib/longevity/types.ts`. */
interface DailyRecord {
  date: string;
  sleep?: Record<string, unknown>;
  cardio?: Record<string, unknown>;
  activity?: Record<string, unknown>;
  body?: Record<string, unknown>;
  vendor?: Record<string, unknown>;
  nutrition?: Record<string, unknown>;
  lifestyle?: Record<string, unknown>;
  subjective?: Record<string, unknown>;
  sources?: DataSource[];
}

/**
 * Zaufanie do źródeł — musi odpowiadać `SOURCE_TRUST` po stronie klienta.
 * Przy konflikcie tej samej metryki wygrywa źródło o wyższej wartości.
 */
const SOURCE_TRUST: Record<DataSource, number> = {
  garmin: 100,
  oura: 95,
  whoop: 92,
  polar: 88,
  apple_health: 85,
  fitbit: 82,
  withings: 76,
  health_connect: 72,
  strava: 50,
  manual: 40,
};

const num = (value: unknown): number | undefined => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined;
};

/** Sekundy → minuty, z zaokrągleniem. Dostawcy raportują w różnych jednostkach. */
const secToMin = (value: unknown): number | undefined => {
  const seconds = num(value);
  return seconds === undefined ? undefined : Math.round(seconds / 60);
};

/** Znacznik czasu ISO → minuty od północy w lokalnej strefie użytkownika. */
const minuteOfDay = (iso: unknown, offsetSeconds = 0): number | undefined => {
  if (typeof iso !== "string") return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  const shifted = new Date(date.getTime() + offsetSeconds * 1000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
};

const isoDate = (value: unknown, fallback: string): string => {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return fallback;
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

// ─────────────────────────────────────────────────────────────────────────────
// Mappery dostawców
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Garmin Health API — priorytet produktu. Payload łączy `dailies`, `sleeps`,
 * `stressDetails` i `userMetrics`; obsługujemy wszystkie w jednym przebiegu.
 */
const mapGarmin = (payload: Record<string, unknown>): DailyRecord[] => {
  const out: Record<string, DailyRecord> = {};

  const ensure = (date: string): DailyRecord => {
    if (!out[date]) out[date] = { date, sources: ["garmin"] };
    return out[date];
  };

  const dailies = (payload.dailies as Array<Record<string, unknown>>) ?? [];
  for (const daily of dailies) {
    const offset = num(daily.startTimeOffsetInSeconds) ?? 0;
    const date = isoDate(daily.calendarDate, todayIso());
    const record = ensure(date);
    record.activity = {
      ...record.activity,
      steps: num(daily.steps),
      activeKcal: num(daily.activeKilocalories),
      totalKcal: num(daily.bmrKilocalories) !== undefined && num(daily.activeKilocalories) !== undefined
        ? (num(daily.bmrKilocalories) as number) + (num(daily.activeKilocalories) as number)
        : undefined,
      distanceKm: num(daily.distanceInMeters) !== undefined ? (num(daily.distanceInMeters) as number) / 1000 : undefined,
      moderateVigorousMin:
        (secToMin(daily.moderateIntensityDurationInSeconds) ?? 0) +
        (secToMin(daily.vigorousIntensityDurationInSeconds) ?? 0) || undefined,
      sedentaryMin: secToMin(daily.sedentaryDurationInSeconds),
      source: "garmin",
    };
    record.cardio = {
      ...record.cardio,
      restingHeartRate: num(daily.restingHeartRateInBeatsPerMinute),
      source: "garmin",
    };
    record.vendor = {
      ...record.vendor,
      // Garmin raportuje Body Battery jako zakres dobowy.
      bodyBattery: num(daily.bodyBatteryChargedValue) !== undefined ? num(daily.bodyBatteryMostRecentValue) : undefined,
      bodyBatteryLow: num(daily.bodyBatteryLowestValue),
      bodyBatteryHigh: num(daily.bodyBatteryHighestValue),
      stressScore: num(daily.averageStressLevel),
      source: "garmin",
    };
    void offset;
  }

  const sleeps = (payload.sleeps as Array<Record<string, unknown>>) ?? [];
  for (const sleep of sleeps) {
    const offset = num(sleep.startTimeOffsetInSeconds) ?? 0;
    const date = isoDate(sleep.calendarDate, todayIso());
    const record = ensure(date);
    const durationMin = secToMin(sleep.durationInSeconds);
    const startIso =
      num(sleep.startTimeInSeconds) !== undefined
        ? new Date((num(sleep.startTimeInSeconds) as number) * 1000).toISOString()
        : undefined;

    record.sleep = {
      ...record.sleep,
      durationMin,
      timeInBedMin:
        durationMin !== undefined && secToMin(sleep.awakeDurationInSeconds) !== undefined
          ? durationMin + (secToMin(sleep.awakeDurationInSeconds) as number)
          : durationMin,
      bedtimeMinOfDay: minuteOfDay(startIso, offset),
      awakenings: num(sleep.awakeCount),
      vendorScore: num((sleep.overallSleepScore as Record<string, unknown> | undefined)?.value),
      stages: {
        deepMin: secToMin(sleep.deepSleepDurationInSeconds),
        remMin: secToMin(sleep.remSleepInSeconds),
        lightMin: secToMin(sleep.lightSleepDurationInSeconds),
        awakeMin: secToMin(sleep.awakeDurationInSeconds),
      },
      avgSpo2: num((sleep.spo2SleepSummary as Record<string, unknown> | undefined)?.averageSpo2),
      respirationRate: num(sleep.averageRespirationValue),
      source: "garmin",
    };
  }

  const metrics = (payload.userMetrics as Array<Record<string, unknown>>) ?? [];
  for (const metric of metrics) {
    const date = isoDate(metric.calendarDate, todayIso());
    const record = ensure(date);
    record.cardio = { ...record.cardio, vo2Max: num(metric.vo2Max), source: "garmin" };
    record.vendor = {
      ...record.vendor,
      enduranceScore: num(metric.enduranceScore),
      hillScore: num(metric.hillScore),
      source: "garmin",
    };
  }

  const hrv = (payload.hrv as Array<Record<string, unknown>>) ?? [];
  for (const entry of hrv) {
    const date = isoDate(entry.calendarDate, todayIso());
    const record = ensure(date);
    record.cardio = { ...record.cardio, hrvMs: num(entry.lastNightAvg), source: "garmin" };
    record.vendor = {
      ...record.vendor,
      hrvStatus: typeof entry.status === "string" ? entry.status.toLowerCase() : undefined,
      source: "garmin",
    };
  }

  const readiness = (payload.trainingReadiness as Array<Record<string, unknown>>) ?? [];
  for (const entry of readiness) {
    const date = isoDate(entry.calendarDate, todayIso());
    const record = ensure(date);
    record.vendor = {
      ...record.vendor,
      trainingReadiness: num(entry.score),
      recoveryTimeH: num(entry.recoveryTime) !== undefined ? (num(entry.recoveryTime) as number) / 60 : undefined,
      source: "garmin",
    };
  }

  return Object.values(out);
};

/** Oura API v2 — `daily_sleep`, `daily_readiness`, `daily_activity`. */
const mapOura = (payload: Record<string, unknown>): DailyRecord[] => {
  const out: Record<string, DailyRecord> = {};
  const ensure = (date: string): DailyRecord => {
    if (!out[date]) out[date] = { date, sources: ["oura"] };
    return out[date];
  };

  for (const sleep of (payload.sleep as Array<Record<string, unknown>>) ?? []) {
    const date = isoDate(sleep.day, todayIso());
    const record = ensure(date);
    record.sleep = {
      ...record.sleep,
      durationMin: secToMin(sleep.total_sleep_duration),
      timeInBedMin: secToMin(sleep.time_in_bed),
      bedtimeMinOfDay: minuteOfDay(sleep.bedtime_start),
      wakeMinOfDay: minuteOfDay(sleep.bedtime_end),
      stages: {
        deepMin: secToMin(sleep.deep_sleep_duration),
        remMin: secToMin(sleep.rem_sleep_duration),
        lightMin: secToMin(sleep.light_sleep_duration),
        awakeMin: secToMin(sleep.awake_time),
      },
      avgHeartRate: num(sleep.average_heart_rate),
      avgHrvMs: num(sleep.average_hrv),
      respirationRate: num(sleep.average_breath),
      vendorScore: num(sleep.score),
      source: "oura",
    };
    record.cardio = {
      ...record.cardio,
      restingHeartRate: num(sleep.lowest_heart_rate),
      hrvMs: num(sleep.average_hrv),
      source: "oura",
    };
  }

  for (const readiness of (payload.readiness as Array<Record<string, unknown>>) ?? []) {
    const record = ensure(isoDate(readiness.day, todayIso()));
    record.vendor = { ...record.vendor, readinessScore: num(readiness.score), source: "oura" };
    const temp = num(readiness.temperature_deviation);
    if (temp !== undefined) record.body = { ...record.body, skinTempDeltaC: temp, source: "oura" };
  }

  for (const activity of (payload.activity as Array<Record<string, unknown>>) ?? []) {
    const record = ensure(isoDate(activity.day, todayIso()));
    record.activity = {
      ...record.activity,
      steps: num(activity.steps),
      activeKcal: num(activity.active_calories),
      totalKcal: num(activity.total_calories),
      sedentaryMin: secToMin(activity.sedentary_time),
      moderateVigorousMin:
        (secToMin(activity.medium_activity_time) ?? 0) + (secToMin(activity.high_activity_time) ?? 0) || undefined,
      source: "oura",
    };
  }

  return Object.values(out);
};

/** WHOOP API v2 — cykle, sen i regeneracja. */
const mapWhoop = (payload: Record<string, unknown>): DailyRecord[] => {
  const out: Record<string, DailyRecord> = {};
  const ensure = (date: string): DailyRecord => {
    if (!out[date]) out[date] = { date, sources: ["whoop"] };
    return out[date];
  };

  for (const recovery of (payload.recovery as Array<Record<string, unknown>>) ?? []) {
    const score = (recovery.score as Record<string, unknown>) ?? {};
    const record = ensure(isoDate(recovery.created_at, todayIso()));
    record.vendor = { ...record.vendor, readinessScore: num(score.recovery_score), source: "whoop" };
    record.cardio = {
      ...record.cardio,
      hrvMs: num(score.hrv_rmssd_milli),
      restingHeartRate: num(score.resting_heart_rate),
      spo2: num(score.spo2_percentage),
      source: "whoop",
    };
    const skinTemp = num(score.skin_temp_celsius);
    if (skinTemp !== undefined) record.body = { ...record.body, bodyTempC: skinTemp, source: "whoop" };
  }

  for (const sleep of (payload.sleep as Array<Record<string, unknown>>) ?? []) {
    const score = (sleep.score as Record<string, unknown>) ?? {};
    const stages = (score.stage_summary as Record<string, unknown>) ?? {};
    const record = ensure(isoDate(sleep.start, todayIso()));
    record.sleep = {
      ...record.sleep,
      durationMin:
        num(stages.total_in_bed_time_milli) !== undefined && num(stages.total_awake_time_milli) !== undefined
          ? Math.round(
              ((num(stages.total_in_bed_time_milli) as number) - (num(stages.total_awake_time_milli) as number)) / 60_000,
            )
          : undefined,
      timeInBedMin:
        num(stages.total_in_bed_time_milli) !== undefined
          ? Math.round((num(stages.total_in_bed_time_milli) as number) / 60_000)
          : undefined,
      bedtimeMinOfDay: minuteOfDay(sleep.start),
      wakeMinOfDay: minuteOfDay(sleep.end),
      awakenings: num(stages.disturbance_count),
      vendorScore: num(score.sleep_performance_percentage),
      stages: {
        deepMin:
          num(stages.total_slow_wave_sleep_time_milli) !== undefined
            ? Math.round((num(stages.total_slow_wave_sleep_time_milli) as number) / 60_000)
            : undefined,
        remMin:
          num(stages.total_rem_sleep_time_milli) !== undefined
            ? Math.round((num(stages.total_rem_sleep_time_milli) as number) / 60_000)
            : undefined,
        lightMin:
          num(stages.total_light_sleep_time_milli) !== undefined
            ? Math.round((num(stages.total_light_sleep_time_milli) as number) / 60_000)
            : undefined,
        awakeMin:
          num(stages.total_awake_time_milli) !== undefined
            ? Math.round((num(stages.total_awake_time_milli) as number) / 60_000)
            : undefined,
      },
      respirationRate: num(score.respiratory_rate),
      source: "whoop",
    };
  }

  for (const cycle of (payload.cycle as Array<Record<string, unknown>>) ?? []) {
    const score = (cycle.score as Record<string, unknown>) ?? {};
    const record = ensure(isoDate(cycle.start, todayIso()));
    record.vendor = { ...record.vendor, strain: num(score.strain), source: "whoop" };
    record.activity = { ...record.activity, activeKcal: num(score.kilojoule) !== undefined ? Math.round((num(score.kilojoule) as number) / 4.184) : undefined, source: "whoop" };
  }

  return Object.values(out);
};

/**
 * Ładunek już znormalizowany po stronie aplikacji mobilnej
 * (Apple HealthKit / Android Health Connect). Ufamy strukturze, ale
 * przycinamy do znanych pól — klient nie może wstrzyknąć dowolnego JSON-a.
 */
const mapNormalized = (payload: Record<string, unknown>, source: DataSource): DailyRecord[] => {
  const records = (payload.records as Array<Record<string, unknown>>) ?? [];
  return records
    .filter((r) => typeof r.date === "string")
    .map((r) => ({
      date: r.date as string,
      sleep: r.sleep as Record<string, unknown> | undefined,
      cardio: r.cardio as Record<string, unknown> | undefined,
      activity: r.activity as Record<string, unknown> | undefined,
      body: r.body as Record<string, unknown> | undefined,
      vendor: r.vendor as Record<string, unknown> | undefined,
      nutrition: r.nutrition as Record<string, unknown> | undefined,
      lifestyle: r.lifestyle as Record<string, unknown> | undefined,
      subjective: r.subjective as Record<string, unknown> | undefined,
      sources: [source],
    }));
};

const MAPPERS: Partial<Record<DataSource, (payload: Record<string, unknown>) => DailyRecord[]>> = {
  garmin: mapGarmin,
  oura: mapOura,
  whoop: mapWhoop,
};

/** Usuwa pola `undefined`, żeby scalanie w bazie nie kasowało istniejących wartości. */
const compact = <T extends Record<string, unknown>>(input: T | undefined): T | undefined => {
  if (!input) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const nested = compact(value as Record<string, unknown>);
      if (nested && Object.keys(nested).length > 0) out[key] = nested;
      continue;
    }
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? (out as T) : undefined;
};

/**
 * Scala nowy rekord z istniejącym. Reguła: pole nadpisujemy tylko wtedy,
 * gdy nowe źródło ma wyższe zaufanie ALBO gdy pole było puste.
 */
const mergeRecord = (existing: DailyRecord | null, incoming: DailyRecord): DailyRecord => {
  if (!existing) return incoming;

  const incomingSource = incoming.sources?.[0] ?? "manual";
  const groups: Array<keyof DailyRecord> = [
    "sleep",
    "cardio",
    "activity",
    "body",
    "vendor",
    "nutrition",
    "lifestyle",
    "subjective",
  ];

  const merged: DailyRecord = { ...existing, date: incoming.date };

  for (const group of groups) {
    const oldGroup = existing[group] as Record<string, unknown> | undefined;
    const newGroup = incoming[group] as Record<string, unknown> | undefined;
    if (!newGroup) continue;
    if (!oldGroup) {
      (merged[group] as unknown) = newGroup;
      continue;
    }

    const oldSource = (oldGroup.source as DataSource | undefined) ?? "manual";
    const oldTrust = SOURCE_TRUST[oldSource] ?? 0;
    const newTrust = SOURCE_TRUST[incomingSource] ?? 0;

    const result: Record<string, unknown> = { ...oldGroup };
    for (const [key, value] of Object.entries(newGroup)) {
      if (value === undefined || value === null) continue;
      if (result[key] === undefined || result[key] === null || newTrust >= oldTrust) {
        result[key] = value;
      }
    }
    (merged[group] as unknown) = result;
  }

  merged.sources = Array.from(new Set([...(existing.sources ?? []), ...(incoming.sources ?? [])]));
  return merged;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metoda nieobsługiwana" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Brak konfiguracji Supabase" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const body = (await req.json()) as {
      provider?: DataSource;
      /** Identyfikator użytkownika u dostawcy (tryb webhooka). */
      providerUserId?: string;
      payload?: Record<string, unknown>;
    };

    const provider = body.provider;
    if (!provider || !(provider in SOURCE_TRUST)) {
      return new Response(JSON.stringify({ error: "Nieznany dostawca" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Ustalenie właściciela danych ────────────────────────────────────────
    let userId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const { data } = await admin.auth.getUser(authHeader.slice(7));
      userId = data.user?.id ?? null;
    }

    if (!userId && body.providerUserId) {
      const { data } = await admin
        .from("longevity_device_links")
        .select("user_id")
        .eq("provider", provider)
        .eq("provider_user_id", body.providerUserId)
        .maybeSingle();
      userId = (data as { user_id: string } | null)?.user_id ?? null;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Nie rozpoznano użytkownika" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Normalizacja ────────────────────────────────────────────────────────
    const mapper = MAPPERS[provider];
    const incoming = mapper
      ? mapper(body.payload ?? {})
      : mapNormalized(body.payload ?? {}, provider);

    if (incoming.length === 0) {
      return new Response(JSON.stringify({ ok: true, merged: 0, note: "Brak danych do zapisania" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Scalenie i zapis ────────────────────────────────────────────────────
    const days = incoming.map((r) => r.date);
    const { data: existingRows } = await admin
      .from("longevity_daily_records")
      .select("day, payload")
      .eq("user_id", userId)
      .in("day", days);

    const existingMap = new Map<string, DailyRecord>();
    for (const row of (existingRows as Array<{ day: string; payload: DailyRecord }> | null) ?? []) {
      existingMap.set(row.day, row.payload);
    }

    const rows = incoming.map((record) => {
      const cleaned: DailyRecord = {
        date: record.date,
        sleep: compact(record.sleep),
        cardio: compact(record.cardio),
        activity: compact(record.activity),
        body: compact(record.body),
        vendor: compact(record.vendor),
        nutrition: compact(record.nutrition),
        lifestyle: compact(record.lifestyle),
        subjective: compact(record.subjective),
        sources: record.sources,
      };
      const merged = mergeRecord(existingMap.get(record.date) ?? null, cleaned);
      return {
        user_id: userId,
        day: record.date,
        payload: merged,
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await admin
      .from("longevity_daily_records")
      .upsert(rows, { onConflict: "user_id,day" });

    if (error) {
      console.error("[stop-aging-sync] zapis nieudany:", error.message);
      return new Response(JSON.stringify({ error: "Zapis nieudany" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Znacznik ostatniej synchronizacji — pokazywany w ekranie „Urządzenia”.
    await admin
      .from("longevity_device_links")
      .update({ last_sync_at: new Date().toISOString(), last_error: null })
      .eq("user_id", userId)
      .eq("provider", provider);

    return new Response(JSON.stringify({ ok: true, merged: rows.length, days }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[stop-aging-sync]", error);
    return new Response(JSON.stringify({ error: "Nieprawidłowe żądanie" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
