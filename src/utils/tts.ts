/**
 * ElevenLabs-powered TTS utility for assistant voice responses.
 * 
 * DJ mode: Rotterdam peak-time energy — LOUD, springy, disco echo effect.
 * Uses Web Audio API for DJ voice processing (gain boost, delay doubling).
 * DJ mode is ElevenLabs ONLY — no browser fallback (real DJ needs real voice).
 * 
 * Audio ducking: automatically lowers music volume while TTS speaks,
 * then smoothly restores it when done.
 * 
 * Exposes isSpeaking flag so voice recognition can pause while TTS is active.
 */

import { neuralSynth } from "@/lib/neuralTts";

let _isSpeaking = false;
let _currentAudio: HTMLAudioElement | null = null;
let _djAudioContext: AudioContext | null = null;
let _djSourceNode: MediaElementAudioSourceNode | null = null;
let _savedMusicVolume: number | null = null;

/**
 * Telefony (Android/iOS) mają zbyt mało pamięci/mocy dla WASM modelu Piper/VITS —
 * synteza tam bywa niestabilna (czasem długo się ładuje, czasem pada), przez co
 * asystent losowo przełączał się na ElevenLabs albo głos systemowy przeglądarki
 * i brzmiał za każdym razem innym głosem. Na mobile pomijamy neuronowy głos
 * i idziemy od razu do ElevenLabs (spójny, jeden głos).
 */
const isMobileDevice = () =>
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

/** Odpal promise z limitem czasu — model WASM potrafi "zawiesić się" bez błędu na słabszym sprzęcie. */
const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);

/** Returns true if the TTS engine is currently speaking */
export const isTTSSpeaking = () => _isSpeaking;

/** Duck music volume down when TTS starts speaking */
const duckMusicVolume = () => {
  // Find the main music audio element managed by PlayerContext
  const musicAudio = document.querySelector("audio[data-player='main']") as HTMLAudioElement | null;
  if (musicAudio && _savedMusicVolume === null) {
    _savedMusicVolume = musicAudio.volume;
    // Smoothly lower to 15% of current volume
    musicAudio.volume = Math.max(musicAudio.volume * 0.15, 0.02);
  }
};

/** Restore music volume after TTS finishes */
const restoreMusicVolume = () => {
  const musicAudio = document.querySelector("audio[data-player='main']") as HTMLAudioElement | null;
  if (musicAudio && _savedMusicVolume !== null) {
    // Smooth fade back up
    const target = _savedMusicVolume;
    const current = musicAudio.volume;
    const steps = 10;
    const stepTime = 50; // 500ms total fade
    let step = 0;
    const fadeInterval = setInterval(() => {
      step++;
      musicAudio.volume = current + (target - current) * (step / steps);
      if (step >= steps) {
        musicAudio.volume = target;
        clearInterval(fadeInterval);
      }
    }, stepTime);
    _savedMusicVolume = null;
  }
};

/** Stop any current speech */
export const stopSpeaking = () => {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.src = "";
    _currentAudio = null;
  }
  if (_djSourceNode) {
    try { _djSourceNode.disconnect(); } catch {}
    _djSourceNode = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  _isSpeaking = false;
  restoreMusicVolume();
};

export type TTSMode = "assistant" | "dj";

/**
 * Apply Web Audio API processing to DJ audio for club sound:
 * - Volume boost (gain, loud and booming)
 * - EQ (presence + bass boost) for a "gruby", cutting-through tone
 * - Compression for punchy sound
 * (Bez echa/delay — czysty, wyraźny głos, pełen temperamentu przez głośność/EQ/kompresję.)
 */
const playDJAudioWithEffects = (audio: HTMLAudioElement): Promise<void> => {
  return new Promise<void>((resolve) => {
    try {
      // Reuse or create AudioContext
      if (!_djAudioContext || _djAudioContext.state === "closed") {
        _djAudioContext = new AudioContext();
      }
      const ctx = _djAudioContext;

      // Resume if suspended
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Create source from audio element
      const source = ctx.createMediaElementSource(audio);
      _djSourceNode = source;

      // === GAIN NODE: Make DJ voice LOUD ===
      const gainNode = ctx.createGain();
      gainNode.gain.value = 2.8; // Loud and booming

      // === COMPRESSOR: Punchy, springy, disco feel ===
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 10;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.15;

      // === HIGH SHELF: Boost presence for "springy" sound ===
      const highShelf = ctx.createBiquadFilter();
      highShelf.type = "highshelf";
      highShelf.frequency.value = 3000;
      highShelf.gain.value = 4; // Bright, cutting through mix

      // === LOW SHELF: Boost bass for booming feel ===
      const lowShelf = ctx.createBiquadFilter();
      lowShelf.type = "lowshelf";
      lowShelf.frequency.value = 200;
      lowShelf.gain.value = 3;

      // === FINAL MIX GAIN: Master output ===
      const masterGain = ctx.createGain();
      masterGain.gain.value = 1.0;

      // Wire up the chain — czysto, bez echa:
      // Source → Gain → EQ → Compressor → Master → Speakers
      source.connect(gainNode);
      gainNode.connect(highShelf);
      highShelf.connect(lowShelf);
      lowShelf.connect(compressor);
      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);

      // Cleanup on end
      const cleanup = () => {
        _isSpeaking = false;
        _currentAudio = null;
        try { source.disconnect(); } catch {}
        _djSourceNode = null;
      };

      audio.onended = () => { cleanup(); resolve(); };
      audio.onerror = () => { cleanup(); resolve(); };

      audio.oncanplaythrough = () => {
        if (_currentAudio !== audio) { cleanup(); resolve(); return; }
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch((e) => {
            console.warn("DJ audio play blocked:", e.message);
            cleanup();
            resolve();
          });
        }
      };

      // Safety timeout
      setTimeout(() => {
        if (_isSpeaking && _currentAudio === audio) {
          console.warn("DJ audio timeout");
          cleanup();
          resolve();
        }
      }, Math.max(15000, 200 * (audio.duration || 10)));

    } catch (err) {
      console.warn("Web Audio DJ effects failed, playing raw:", err);
      // Fallback: just play loud without effects
      audio.volume = 1.0;
      audio.onended = () => { _isSpeaking = false; _currentAudio = null; resolve(); };
      audio.onerror = () => { _isSpeaking = false; _currentAudio = null; resolve(); };
      audio.oncanplaythrough = () => {
        if (_currentAudio !== audio) { _isSpeaking = false; _currentAudio = null; resolve(); return; }
        audio.play().catch(() => { _isSpeaking = false; _currentAudio = null; resolve(); });
      };
    }
  });
};

/**
 * Speak text via ElevenLabs API (edge function).
 * DJ mode: ElevenLabs ONLY with Web Audio effects (no browser fallback).
 * Assistant mode: ElevenLabs with browser Speech Synthesis fallback.
 */
export const speak = async (text: string, opts?: { 
  rate?: number; 
  pitch?: number; 
  lang?: string;
  mode?: TTSMode;
}): Promise<void> => {
  if (!text || text.trim().length === 0) return;

  // Cancel any ongoing speech
  stopSpeaking();

  const mode = opts?.mode || "assistant";

  // === PRIMARY: darmowy neuronowy głos w przeglądarce (Piper/VITS) ===
  // Rewelacyjna jakość, zero kosztów i tokenów. Gdy niedostępny — schodzimy
  // po cichu na ElevenLabs, a potem na głos przeglądarki.
  // Pomijamy na telefonach — patrz komentarz przy isMobileDevice().
  if (!isMobileDevice()) try {
    _isSpeaking = true;
    duckMusicVolume();
    const wav = await withTimeout(neuralSynth(text, opts?.lang), 6000);
    if (wav) {
      const audioUrl = URL.createObjectURL(wav);
      const audio = new Audio();
      _currentAudio = audio;
      audio.preload = "auto";
      audio.src = audioUrl;

      if (mode === "dj") {
        await playDJAudioWithEffects(audio);
        try { URL.revokeObjectURL(audioUrl); } catch { /* */ }
        restoreMusicVolume();
        return;
      }
      return await new Promise<void>((resolve) => {
        const cleanup = () => {
          _isSpeaking = false; _currentAudio = null; restoreMusicVolume();
          try { URL.revokeObjectURL(audioUrl); } catch { /* */ }
        };
        audio.onended = () => { cleanup(); resolve(); };
        audio.onerror = () => { cleanup(); resolve(); };
        const p = audio.play();
        if (p) p.catch(() => { cleanup(); resolve(); });
      });
    }
    // neuronowy niedostępny → przywróć głośność i próbuj dalej
    _isSpeaking = false;
    restoreMusicVolume();
  } catch (e) {
    console.warn("[tts] neuronowy głos nieudany, próbuję dalej:", e);
    _isSpeaking = false;
    restoreMusicVolume();
  }

  // Try ElevenLabs
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) throw new Error("No Supabase config");

    _isSpeaking = true;
    duckMusicVolume();

    const response = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ text, mode, lang: opts?.lang }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      const isFallback = errorBody.includes('"fallback":true') || errorBody.includes("fallback");
      const isQuotaExceeded = errorBody.includes("quota_exceeded");
      if (isFallback || isQuotaExceeded) {
        console.warn("ElevenLabs unavailable, using browser TTS fallback");
        throw new Error("fallback_to_browser");
      }
      throw new Error(`TTS API error: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("audio")) throw new Error("Not audio response");

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    const audio = new Audio();
    _currentAudio = audio;
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audio.src = audioUrl;

    if (mode === "dj") {
      // DJ mode: Web Audio API with echo, boost, compression
      await playDJAudioWithEffects(audio);
      try { URL.revokeObjectURL(audioUrl); } catch {}
    } else {
      // Assistant mode: normal playback
      return new Promise<void>((resolve) => {
        const cleanup = () => {
          _isSpeaking = false;
          _currentAudio = null;
          try { URL.revokeObjectURL(audioUrl); } catch {}
        };
        
        audio.onended = () => { cleanup(); resolve(); };
        audio.onerror = (e) => { 
          console.warn("ElevenLabs audio playback error, falling back to browser TTS:", e);
          cleanup(); 
          speakBrowser(text, opts).then(resolve);
        };

        audio.oncanplaythrough = () => {
          if (_currentAudio !== audio) { cleanup(); resolve(); return; }
          const playPromise = audio.play();
          if (playPromise) {
            playPromise.catch((e) => {
              console.warn("ElevenLabs audio play blocked:", e.message);
              cleanup();
              speakBrowser(text, opts).then(resolve);
            });
          }
        };

        setTimeout(() => {
          if (_isSpeaking && _currentAudio === audio) {
            console.warn("ElevenLabs audio timeout, falling back to browser TTS");
            cleanup();
            speakBrowser(text, opts).then(resolve);
          }
        }, Math.max(text.length * 150, 8000));
      });
    }
  } catch (err) {
    console.warn("ElevenLabs TTS failed:", err);
    _isSpeaking = false;
    
    // DJ mode: NO browser fallback — real DJ needs real voice
    if (mode === "dj") {
      console.warn("DJ mode: ElevenLabs failed, skipping (no browser fallback for DJ)");
      return;
    }
    // Assistant: fallback to browser Speech Synthesis
    return speakBrowser(text, opts);
  }
};

/** Browser Speech Synthesis fallback (assistant only) */
const speakBrowser = (text: string, opts?: {
  rate?: number;
  pitch?: number;
  lang?: string;
  mode?: TTSMode;
}): Promise<void> => {
  if (!("speechSynthesis" in window)) return Promise.resolve();

  window.speechSynthesis.cancel();

  const mode = opts?.mode || "assistant";
  const requestedLang = opts?.lang || "pl-PL";
  const djDefaults = { rate: 1.22, pitch: 1.08 };
  const assistantDefaults = { rate: 0.95, pitch: 0.75 };
  const defaults = mode === "dj" ? djDefaults : assistantDefaults;

  const trySpeak = (voices: SpeechSynthesisVoice[]) => {
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = requestedLang;
      utterance.rate = opts?.rate ?? defaults.rate;
      utterance.pitch = opts?.pitch ?? defaults.pitch;

      const maleKeywords = /male|męs|adam|jacek|jan|krzyszt|łukasz|marcin|paweł|piotr|tomasz|mateusz|daniel|george|james|david|mark/i;
      const femaleKeywords = /female|kobieta|żeń|ewa|anna|agnieszk|magda|monika|zofia|paulina|google.*female/i;
      const langPrefix = requestedLang.split("-")[0];
      const langMaleVoice = voices.find(v => v.lang.startsWith(langPrefix) && maleKeywords.test(v.name));
      const langNonFemaleVoice = voices.find(v => v.lang.startsWith(langPrefix) && !femaleKeywords.test(v.name));
      const langAnyVoice = voices.find(v => v.lang.startsWith(langPrefix));
      const enMaleVoice = voices.find(v => v.lang.startsWith("en") && maleKeywords.test(v.name));
      const selectedVoice = langMaleVoice || langNonFemaleVoice || langAnyVoice || enMaleVoice || voices[0];

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        const isFemale = femaleKeywords.test(selectedVoice.name);
        if (isFemale || (!langMaleVoice && !langNonFemaleVoice && langAnyVoice === selectedVoice)) {
          utterance.pitch = Math.min(opts?.pitch ?? 0.45, 0.45);
          utterance.rate = opts?.rate ?? 0.90;
        }
      }

      _isSpeaking = true;
      duckMusicVolume();
      utterance.onend = () => { _isSpeaking = false; restoreMusicVolume(); resolve(); };
      utterance.onerror = () => { _isSpeaking = false; restoreMusicVolume(); resolve(); };
      window.speechSynthesis.speak(utterance);

      setTimeout(() => {
        if (_isSpeaking) { _isSpeaking = false; restoreMusicVolume(); resolve(); }
      }, Math.max(text.length * 100, 3000));
    });
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) return trySpeak(voices);

  return new Promise<void>((resolve) => {
    const onVoices = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      trySpeak(window.speechSynthesis.getVoices()).then(resolve);
    };
    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      trySpeak(window.speechSynthesis.getVoices()).then(resolve);
    }, 1000);
  });
};
