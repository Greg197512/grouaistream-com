/**
 * Browser-based TTS utility for assistant voice responses.
 * Uses Web Speech Synthesis API with Polish language.
 */
export const speak = (text: string, opts?: { rate?: number; pitch?: number }) => {
  if (!("speechSynthesis" in window)) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

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

  window.speechSynthesis.speak(utterance);
};
