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

let _isSpeaking = false;
let _currentAudio: HTMLAudioElement | null = null;
let _djAudioContext: AudioContext | null = null;
let _djSourceNode: MediaElementAudioSourceNode | null = null;
let _savedMusicVolume: number | null = null;

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
};

export type TTSMode = "assistant" | "dj";

/**
 * Apply Web Audio API processing to DJ audio for club sound:
 * - Volume boost (gain 2.5x)
 * - Delay echo effect (doubling voice, 80ms + 160ms delays)
 * - Slight compression for punchy sound
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

      // === DELAY 1: Short echo (voice doubling effect) ===
      const delay1 = ctx.createDelay(1.0);
      delay1.delayTime.value = 0.07; // 70ms - tight doubling
      const delay1Gain = ctx.createGain();
      delay1Gain.gain.value = 0.45; // Strong echo

      // === DELAY 2: Longer echo (club reverb feel) ===
      const delay2 = ctx.createDelay(1.0);
      delay2.delayTime.value = 0.15; // 150ms - room echo
      const delay2Gain = ctx.createGain();
      delay2Gain.gain.value = 0.25; // Softer second echo

      // === DELAY 3: Tail echo (fading out) ===
      const delay3 = ctx.createDelay(1.0);
      delay3.delayTime.value = 0.28; // 280ms - fading tail
      const delay3Gain = ctx.createGain();
      delay3Gain.gain.value = 0.12;

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

      // Wire up the chain:
      // Source → Gain → EQ → Compressor → Master (dry path)
      source.connect(gainNode);
      gainNode.connect(highShelf);
      highShelf.connect(lowShelf);
      lowShelf.connect(compressor);
      compressor.connect(masterGain);

      // Echo paths (parallel from compressor output)
      compressor.connect(delay1);
      delay1.connect(delay1Gain);
      delay1Gain.connect(masterGain);

      compressor.connect(delay2);
      delay2.connect(delay2Gain);
      delay2Gain.connect(masterGain);

      compressor.connect(delay3);
      delay3.connect(delay3Gain);
      delay3Gain.connect(masterGain);

      // Master → Speakers
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

  // Try ElevenLabs
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) throw new Error("No Supabase config");

    _isSpeaking = true;

    const response = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ text, mode }),
    });

    if (!response.ok) throw new Error(`TTS API error: ${response.status}`);

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
  const assistantDefaults = { rate: 1.0, pitch: 0.85 };
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
          utterance.pitch = Math.min(opts?.pitch ?? 0.55, 0.55);
          utterance.rate = opts?.rate ?? 0.92;
        }
      }

      _isSpeaking = true;
      utterance.onend = () => { _isSpeaking = false; resolve(); };
      utterance.onerror = () => { _isSpeaking = false; resolve(); };
      window.speechSynthesis.speak(utterance);

      setTimeout(() => {
        if (_isSpeaking) { _isSpeaking = false; resolve(); }
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
