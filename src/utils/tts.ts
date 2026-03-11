/**
 * ElevenLabs-powered TTS utility for assistant voice responses.
 * Falls back to browser Speech Synthesis if ElevenLabs fails.
 * 
 * DJ mode: Rotterdam peak-time energy — fast rate, punchy, aggressive.
 * Exposes isSpeaking flag so voice recognition can pause while TTS is active.
 */

let _isSpeaking = false;
let _currentAudio: HTMLAudioElement | null = null;

/** Returns true if the TTS engine is currently speaking */
export const isTTSSpeaking = () => _isSpeaking;

/** Stop any current speech */
export const stopSpeaking = () => {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.src = "";
    _currentAudio = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  _isSpeaking = false;
};

export type TTSMode = "assistant" | "dj";

/**
 * Speak text via ElevenLabs API (edge function).
 * Falls back to browser Speech Synthesis on failure.
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

  // Try ElevenLabs first
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
    
    return new Promise<void>((resolve) => {
      const audio = new Audio(audioUrl);
      _currentAudio = audio;
      
      audio.onended = () => {
        _isSpeaking = false;
        _currentAudio = null;
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      
      audio.onerror = () => {
        _isSpeaking = false;
        _currentAudio = null;
        URL.revokeObjectURL(audioUrl);
        resolve();
      };

      audio.play().catch(() => {
        _isSpeaking = false;
        _currentAudio = null;
        URL.revokeObjectURL(audioUrl);
        resolve();
      });

      // Safety timeout
      setTimeout(() => {
        if (_isSpeaking && _currentAudio === audio) {
          _isSpeaking = false;
          _currentAudio = null;
          URL.revokeObjectURL(audioUrl);
          resolve();
        }
      }, Math.max(text.length * 150, 5000));
    });
  } catch (err) {
    console.warn("ElevenLabs TTS failed, falling back to browser:", err);
    _isSpeaking = false;
    // Fallback to browser Speech Synthesis
    return speakBrowser(text, opts);
  }
};

/** Browser Speech Synthesis fallback */
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
        if (mode === "dj") {
          if (isFemale) { utterance.pitch = 0.75; utterance.rate = opts?.rate ?? 1.2; }
        } else {
          if (isFemale || (!langMaleVoice && !langNonFemaleVoice && langAnyVoice === selectedVoice)) {
            utterance.pitch = Math.min(opts?.pitch ?? 0.55, 0.55);
            utterance.rate = opts?.rate ?? 0.92;
          }
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
