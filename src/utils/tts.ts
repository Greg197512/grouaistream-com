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
export const speak = (text: string, opts?: { rate?: number; pitch?: number }): Promise<void> => {
  if (!("speechSynthesis" in window)) return Promise.resolve();

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pl-PL";
    utterance.rate = opts?.rate ?? 0.95;
    utterance.pitch = opts?.pitch ?? 1.1;

    // Try to find a Polish voice
    const voices = window.speechSynthesis.getVoices();
    const plVoice = voices.find(v => v.lang.startsWith("pl"))
      || voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("female"))
      || voices[0];

    if (plVoice) utterance.voice = plVoice;

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

    // Safety timeout – some browsers never fire onend for short utterances
    setTimeout(() => {
      if (_isSpeaking) {
        _isSpeaking = false;
        resolve();
      }
    }, Math.max(text.length * 120, 3000));
  });
};
