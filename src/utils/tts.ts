/**
 * Browser-based TTS utility for assistant voice responses.
 * Uses Web Speech Synthesis API with language detection.
 * 
 * DJ mode: Rotterdam peak-time energy — fast rate, punchy, aggressive.
 * Exposes isSpeaking flag so voice recognition can pause while TTS is active.
 */

let _isSpeaking = false;

/** Returns true if the TTS engine is currently speaking */
export const isTTSSpeaking = () => _isSpeaking;

/** Stop any current speech */
export const stopSpeaking = () => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  _isSpeaking = false;
};

export type TTSMode = "assistant" | "dj";

/**
 * Speak text via Web Speech Synthesis.
 * mode="dj" uses faster rate (1.22), higher pitch (1.08) for Rotterdam club DJ energy.
 * Returns a Promise that resolves when speech ends.
 */
export const speak = (text: string, opts?: { 
  rate?: number; 
  pitch?: number; 
  lang?: string;
  mode?: TTSMode;
}): Promise<void> => {
  if (!("speechSynthesis" in window)) return Promise.resolve();

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const mode = opts?.mode || "assistant";
  const requestedLang = opts?.lang || "pl-PL";

  // DJ mode: FAST, AGGRESSIVE, PUNCHY — Rotterdam peak-time energy
  const djDefaults = { rate: 1.22, pitch: 1.08 };
  const assistantDefaults = { rate: 1.0, pitch: 0.85 };
  const defaults = mode === "dj" ? djDefaults : assistantDefaults;

  const trySpeak = (voices: SpeechSynthesisVoice[]) => {
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = requestedLang;
      utterance.rate = opts?.rate ?? defaults.rate;
      utterance.pitch = opts?.pitch ?? defaults.pitch;

      // Voice selection — prefer male voices for DJ
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
          // DJ mode: even with female voice, keep energy HIGH
          if (isFemale) {
            utterance.pitch = 0.75; // lower but keep aggressive
            utterance.rate = opts?.rate ?? 1.2; // fast and punchy
          }
        } else {
          // Assistant mode: deep masculine
          if (isFemale || (!langMaleVoice && !langNonFemaleVoice && langAnyVoice === selectedVoice)) {
            utterance.pitch = Math.min(opts?.pitch ?? 0.55, 0.55);
            utterance.rate = opts?.rate ?? 0.92;
          }
        }
      }

      _isSpeaking = true;

      utterance.onend = () => {
        _isSpeaking = false;
        resolve();
      };
      utterance.onerror = () => {
        _isSpeaking = false;
        resolve();
      };

      window.speechSynthesis.speak(utterance);

      // Safety timeout
      setTimeout(() => {
        if (_isSpeaking) {
          _isSpeaking = false;
          resolve();
        }
      }, Math.max(text.length * 100, 3000));
    });
  };

  // Voices may load asynchronously on mobile
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    return trySpeak(voices);
  }

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
