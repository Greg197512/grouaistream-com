/**
 * ElevenLabs-powered TTS utility for assistant voice responses.
 * 
 * DJ mode: natural human club DJ voice — clear, present, slightly boosted,
 * without heavy processing that makes it sound robotic.
 */

import { neuralSynth } from "@/lib/neuralTts";

let _isSpeaking = false;
let _currentAudio: HTMLAudioElement | null = null;
let _djAudioContext: AudioContext | null = null;
let _djSourceNode: MediaElementAudioSourceNode | null = null;
let _savedMusicVolume: number | null = null;

const isMobileDevice = () =>
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);

export const isTTSSpeaking = () => _isSpeaking;

const duckMusicVolume = () => {
  const musicAudio = document.querySelector("audio[data-player='main']") as HTMLAudioElement | null;
  if (musicAudio && _savedMusicVolume === null) {
    _savedMusicVolume = musicAudio.volume;
    musicAudio.volume = Math.max(musicAudio.volume * 0.15, 0.02);
  }
};

const restoreMusicVolume = () => {
  const musicAudio = document.querySelector("audio[data-player='main']") as HTMLAudioElement | null;
  if (musicAudio && _savedMusicVolume !== null) {
    const target = _savedMusicVolume;
    const current = musicAudio.volume;
    const steps = 10;
    const stepTime = 50;
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
 * Natural DJ voice processing — clear and present, but human.
 * Mild boost only. No heavy compression or extreme EQ.
 */
const playDJAudioWithEffects = (audio: HTMLAudioElement): Promise<void> => {
  return new Promise<void>((resolve) => {
    try {
      if (!_djAudioContext || _djAudioContext.state === "closed") {
        _djAudioContext = new AudioContext();
      }
      const ctx = _djAudioContext;
      if (ctx.state === "suspended") ctx.resume();

      const source = ctx.createMediaElementSource(audio);
      _djSourceNode = source;

      // Mild presence boost — keeps it human
      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.4;

      const highShelf = ctx.createBiquadFilter();
      highShelf.type = "highshelf";
      highShelf.frequency.value = 2800;
      highShelf.gain.value = 1.8;

      const masterGain = ctx.createGain();
      masterGain.gain.value = 1.0;

      source.connect(gainNode);
      gainNode.connect(highShelf);
      highShelf.connect(masterGain);
      masterGain.connect(ctx.destination);

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
        audio.play().catch(() => { cleanup(); resolve(); });
      };

      setTimeout(() => {
        if (_isSpeaking && _currentAudio === audio) {
          cleanup();
          resolve();
        }
      }, Math.max(15000, 200 * (audio.duration || 10)));
    } catch (err) {
      console.warn("DJ audio effects failed, playing raw:", err);
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

export const speak = async (text: string, opts?: { 
  rate?: number; 
  pitch?: number; 
  lang?: string;
  mode?: TTSMode;
}): Promise<void> => {
  if (!text || text.trim().length === 0) return;
  stopSpeaking();
  const mode = opts?.mode || "assistant";

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
        try { URL.revokeObjectURL(audioUrl); } catch {}
        restoreMusicVolume();
        return;
      }
      return await new Promise<void>((resolve) => {
        const cleanup = () => {
          _isSpeaking = false; _currentAudio = null; restoreMusicVolume();
          try { URL.revokeObjectURL(audioUrl); } catch {}
        };
        audio.onended = () => { cleanup(); resolve(); };
        audio.onerror = () => { cleanup(); resolve(); };
        const p = audio.play();
        if (p) p.catch(() => { cleanup(); resolve(); });
      });
    }
    _isSpeaking = false;
    restoreMusicVolume();
  } catch (e) {
    console.warn("[tts] neural voice failed:", e);
    _isSpeaking = false;
    restoreMusicVolume();
  }

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
      if (errorBody.includes("fallback") || errorBody.includes("quota_exceeded")) {
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
      await playDJAudioWithEffects(audio);
      try { URL.revokeObjectURL(audioUrl); } catch {}
    } else {
      return new Promise<void>((resolve) => {
        const cleanup = () => {
          _isSpeaking = false;
          _currentAudio = null;
          try { URL.revokeObjectURL(audioUrl); } catch {}
        };
        audio.onended = () => { cleanup(); resolve(); };
        audio.onerror = () => { cleanup(); speakBrowser(text, opts).then(resolve); };
        audio.oncanplaythrough = () => {
          if (_currentAudio !== audio) { cleanup(); resolve(); return; }
          audio.play().catch(() => { cleanup(); speakBrowser(text, opts).then(resolve); });
        };
        setTimeout(() => {
          if (_isSpeaking && _currentAudio === audio) {
            cleanup();
            speakBrowser(text, opts).then(resolve);
          }
        }, Math.max(text.length * 150, 8000));
      });
    }
  } catch (err) {
    console.warn("ElevenLabs TTS failed:", err);
    _isSpeaking = false;
    if (mode === "dj") return;
    return speakBrowser(text, opts);
  }
};

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
  const djDefaults = { rate: 1.05, pitch: 1.0 };
  const assistantDefaults = { rate: 0.95, pitch: 0.75 };
  const defaults = mode === "dj" ? djDefaults : assistantDefaults;

  const trySpeak = (voices: SpeechSynthesisVoice[]) => {
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = requestedLang;
      utterance.rate = opts?.rate ?? defaults.rate;
      utterance.pitch = opts?.pitch ?? defaults.pitch;

      const maleKeywords = /male|męs|adam|jacek|jan|krzyszt|łukasz|marcin|paweł|piotr|tomasz|mateusz|daniel|george|james|david|mark/i;
      const langPrefix = requestedLang.split("-")[0];
      const langMaleVoice = voices.find(v => v.lang.startsWith(langPrefix) && maleKeywords.test(v.name));
      const langAnyVoice = voices.find(v => v.lang.startsWith(langPrefix));
      const selectedVoice = langMaleVoice || langAnyVoice || voices[0];

      if (selectedVoice) utterance.voice = selectedVoice;

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
