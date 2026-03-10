/**
 * Browser-based TTS utility for assistant voice responses.
 * Uses Web Speech Synthesis API with Polish language.
 * 
 * Exposes isSpeaking flag so voice recognition can pause while TTS is active.
 */

let _isSpeaking = false;

/** Returns true if the TTS engine is currently speaking */
export const isTTSSpeaking = () => _isSpeaking;

/**
 * Speak text via Web Speech Synthesis.
 * Returns a Promise that resolves when speech ends (or immediately if unsupported).
 */
export const speak = (text: string, opts?: { rate?: number; pitch?: number; lang?: string }): Promise<void> => {
  if (!("speechSynthesis" in window)) return Promise.resolve();

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const requestedLang = opts?.lang || "pl-PL";

  const trySpeak = (voices: SpeechSynthesisVoice[]) => {
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = requestedLang;
      utterance.rate = opts?.rate ?? 1.0;
      utterance.pitch = opts?.pitch ?? 0.85;

      // Prefer male Polish voice; on mobile devices voices are limited so we
      // lower the pitch to sound more masculine when only a female voice exists.
      const maleKeywords = /male|męs|adam|jacek|jan|krzyszt|łukasz|marcin|paweł|piotr|tomasz|mateusz/i;
      const femaleKeywords = /female|kobieta|żeń|ewa|anna|agnieszk|magda|monika|zofia|paulina|google.*pl.*female/i;

      const plMaleVoice = voices.find(v => v.lang.startsWith("pl") && maleKeywords.test(v.name));
      const plNonFemaleVoice = voices.find(v => v.lang.startsWith("pl") && !femaleKeywords.test(v.name));
      const plAnyVoice = voices.find(v => v.lang.startsWith("pl"));
      const enMaleVoice = voices.find(v => v.lang.startsWith("en") && /male|daniel|george|james|david/i.test(v.name));

      const selectedVoice = plMaleVoice || plNonFemaleVoice || plAnyVoice || enMaleVoice || voices[0];

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        // If we ended up with a female voice, lower pitch to sound more masculine
        const isFemale = femaleKeywords.test(selectedVoice.name);
        if (isFemale || (!plMaleVoice && !plNonFemaleVoice && plAnyVoice === selectedVoice)) {
          utterance.pitch = Math.min(opts?.pitch ?? 0.55, 0.55);
          utterance.rate = opts?.rate ?? 0.92;
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
      }, Math.max(text.length * 120, 3000));
    });
  };

  // Voices may load asynchronously on mobile — wait for them if empty
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
    // Fallback if voiceschanged never fires
    setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      trySpeak(window.speechSynthesis.getVoices()).then(resolve);
    }, 1000);
  });
};
