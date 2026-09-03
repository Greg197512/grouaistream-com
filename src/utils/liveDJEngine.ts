/**
 * LiveDJEngine — żywe, ciągłe miksowanie utworów w trybie AI DJ.
 *
 * W przeciwieństwie do audioMixer.ts (który offline'owo renderuje DWA
 * konkretne pliki w jeden plik wynikowy, z pełnym beatmatchem opartym
 * o zdekodowany bufor), ten silnik miksuje NA ŻYWO cały, potencjalnie
 * długi set, utwór po utworze, strumieniowo — bez pobierania i dekodowania
 * całych plików z góry. Dlatego świadomie NIE robi pełnego beatmatchingu
 * (wymagałby zdekodowanego bufora każdego kolejnego utworu z wyprzedzeniem),
 * tylko techniki, które da się zastosować live na elementach <audio>:
 *
 *  - długi, równomocny (equal-power) crossfade między utworami,
 *  - EQ carving: podczas przejścia wycinamy bas z utworu wychodzącego
 *    (highpass filter sweep), żeby bas nowego utworu wszedł czysto —
 *    to samo, czego prawdziwi DJ-e używają na mikserze klubowym,
 *  - kompresor/limiter na magistrali głównej, żeby głośność była
 *    spójna między utworami o różnej głośności źródłowej.
 *
 * Crossfade (Web Audio) wymaga plików z nagłówkiem Access-Control-Allow-Origin.
 * Gdy pliku bez CORS nie da się załadować (np. część świeżych uploadów z R2),
 * silnik zgłasza onLoadError — odbiorca (PlayerContext) porzuca wtedy crossfade
 * i gra listę zwykłym elementem <audio> (bez CORS gra ZAWSZE). Dzięki temu
 * muzyka nigdy się nie „zacina" przez brak nagłówków — najwyżej bez miksu.
 */

export interface DJEngineTrack {
  id: string;
  title: string;
  artist: string;
  audio_url: string | null;
  video_url?: string | null;
  duration: number;
}

interface Deck {
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  track: DJEngineTrack | null;
}

const CROSSFADE_SECONDS = 7;
const BASS_CARVE_HZ = 220;

export class LiveDJEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private compressor: DynamicsCompressorNode;
  private decks: [Deck, Deck];
  private activeDeckIndex: 0 | 1 = 0;
  private queue: DJEngineTrack[] = [];
  private queueIndex = 0;
  private crossfading = false;
  private destroyed = false;
  private pollTimer: number | null = null;
  private volume = 70;
  private muted = false;

  onTrackChange: ((track: DJEngineTrack, index: number) => void) | null = null;
  onTimeUpdate: ((currentTime: number, duration: number) => void) | null = null;
  onSessionEnded: (() => void) | null = null;
  // Wywoływane, gdy źródło NIE da się odtworzyć przez Web Audio (brak nagłówków
  // CORS na pliku — częste dla świeżo wgranych utworów z R2). Odbiorca powinien
  // wtedy porzucić crossfade i zagrać listę zwykłym elementem <audio> (bez CORS).
  onLoadError: ((track: DJEngineTrack | null) => void) | null = null;
  private failed = false;

  constructor() {
    this.ctx = new AudioContext();
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(24, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(3.5, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.006, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.compressor.connect(this.masterGain).connect(this.ctx.destination);
    this.decks = [this.createDeck(), this.createDeck()];
  }

  private createDeck(): Deck {
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    const source = this.ctx.createMediaElementSource(audio);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "allpass"; // neutralne, dopóki nie zaczniemy carvingu
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(this.compressor);
    return { audio, source, filter, gain, track: null };
  }

  private get activeDeck(): Deck { return this.decks[this.activeDeckIndex]; }
  private get inactiveDeck(): Deck { return this.decks[this.activeDeckIndex === 0 ? 1 : 0]; }

  private async resumeCtx() {
    if (this.ctx.state === "suspended") { try { await this.ctx.resume(); } catch { /* ignore */ } }
  }

  private loadIntoDeck(deck: Deck, track: DJEngineTrack) {
    const url = track.audio_url || track.video_url || "";
    deck.audio.pause();
    deck.audio.removeAttribute("src");
    deck.audio.load();
    // Jednorazowy nasłuch błędu ładowania: gdy plik nie ma CORS, przeglądarka
    // (przy crossOrigin="anonymous") odrzuca zasób i emituje 'error' — wtedy
    // zgłaszamy onLoadError, żeby przełączyć się na zwykłe odtwarzanie.
    const onErr = () => {
      deck.audio.removeEventListener("error", onErr);
      if (this.destroyed || this.failed) return;
      this.failed = true;
      this.onLoadError?.(track);
    };
    deck.audio.addEventListener("error", onErr);
    deck.audio.src = url;
    deck.audio.load();
    deck.track = track;
    deck.filter.type = "allpass";
    deck.filter.frequency.cancelScheduledValues(this.ctx.currentTime);
    deck.gain.gain.cancelScheduledValues(this.ctx.currentTime);
  }

  /** Uruchamia set od podanego indeksu. */
  async start(tracks: DJEngineTrack[], startIndex = 0) {
    this.queue = tracks;
    this.queueIndex = startIndex;
    await this.resumeCtx();

    const first = this.queue[this.queueIndex];
    const deck = this.activeDeck;
    this.loadIntoDeck(deck, first);
    deck.gain.gain.setValueAtTime(1, this.ctx.currentTime);
    try {
      await deck.audio.play();
    } catch (e) {
      console.error("[LiveDJEngine] start play() failed:", e);
      // Autoplay zablokowany na telefonie to NIE jest błąd źródła — nie przełączaj.
      const name = (e as { name?: string })?.name;
      if (name !== "NotAllowedError" && !this.destroyed && !this.failed) {
        this.failed = true;
        this.onLoadError?.(first);
      }
    }
    // Jeśli w międzyczasie zgłoszono błąd źródła (CORS) lub zniszczono silnik —
    // nie uruchamiaj pollingu ani nie zgłaszaj zmiany utworu (fallback przejął).
    if (this.failed || this.destroyed) return;
    this.onTrackChange?.(first, this.queueIndex);
    this.startPolling();
  }

  private startPolling() {
    if (this.pollTimer) window.clearInterval(this.pollTimer);
    this.pollTimer = window.setInterval(() => this.tick(), 250);
  }

  private tick() {
    if (this.destroyed) return;
    const deck = this.activeDeck;
    if (!deck.audio.duration || Number.isNaN(deck.audio.duration)) return;

    this.onTimeUpdate?.(deck.audio.currentTime, deck.audio.duration);

    const remaining = deck.audio.duration - deck.audio.currentTime;
    const hasNext = this.queueIndex + 1 < this.queue.length;

    if (!this.crossfading && hasNext && remaining <= CROSSFADE_SECONDS && remaining > 0.05) {
      void this.beginCrossfade();
    } else if (!this.crossfading && !hasNext && remaining <= 0.3) {
      this.onSessionEnded?.();
    }
  }

  private async beginCrossfade() {
    this.crossfading = true;
    const outgoing = this.activeDeck;
    const incoming = this.inactiveDeck;
    const nextIndex = this.queueIndex + 1;
    const nextTrack = this.queue[nextIndex];
    if (!nextTrack) { this.crossfading = false; return; }

    this.loadIntoDeck(incoming, nextTrack);
    incoming.gain.gain.setValueAtTime(0, this.ctx.currentTime);

    const now = this.ctx.currentTime;
    const dur = Math.min(CROSSFADE_SECONDS, outgoing.audio.duration - outgoing.audio.currentTime);

    try {
      await incoming.audio.play();
    } catch (e) {
      console.error("[LiveDJEngine] crossfade incoming play() failed:", e);
      this.crossfading = false;
      return;
    }

    // Equal-power crossfade (brzmi płynnie, bez zapadnięcia głośności w środku).
    const steps = 40;
    const outCurve = new Float32Array(steps);
    const inCurve = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const x = i / (steps - 1);
      outCurve[i] = Math.cos((x * Math.PI) / 2);
      inCurve[i] = Math.sin((x * Math.PI) / 2);
    }
    outgoing.gain.gain.setValueCurveAtTime(outCurve, now, dur);
    incoming.gain.gain.setValueCurveAtTime(inCurve, now, dur);

    // EQ carving: wytnij bas z utworu wychodzącego, żeby bas nowego wszedł czysto.
    outgoing.filter.type = "highpass";
    outgoing.filter.frequency.setValueAtTime(20, now);
    outgoing.filter.frequency.linearRampToValueAtTime(BASS_CARVE_HZ, now + dur);

    window.setTimeout(() => {
      if (this.destroyed) return;
      outgoing.audio.pause();
      outgoing.audio.removeAttribute("src");
      outgoing.track = null;
      this.activeDeckIndex = this.activeDeckIndex === 0 ? 1 : 0;
      this.queueIndex = nextIndex;
      this.crossfading = false;
      this.onTrackChange?.(nextTrack, this.queueIndex);
    }, Math.max(0, dur * 1000));
  }

  /** Natychmiastowe (krótsze) przejście do następnego utworu — np. przycisk "Skip". */
  async skipToNext() {
    if (this.crossfading) return;
    if (this.queueIndex + 1 >= this.queue.length) { this.onSessionEnded?.(); return; }
    const outgoing = this.activeDeck;
    // Skróć bieżący utwór tak, żeby naturalny tick() zaczął krótki crossfade od razu.
    if (outgoing.audio.duration) {
      outgoing.audio.currentTime = Math.max(0, outgoing.audio.duration - 2);
    }
  }

  pause() {
    this.activeDeck.audio.pause();
    if (this.crossfading) this.inactiveDeck.audio.pause();
  }

  async resume() {
    await this.resumeCtx();
    try { await this.activeDeck.audio.play(); } catch { /* ignore */ }
    if (this.crossfading) { try { await this.inactiveDeck.audio.play(); } catch { /* ignore */ } }
  }

  seek(pct: number) {
    const deck = this.activeDeck;
    if (!deck.audio.duration) return;
    deck.audio.currentTime = (pct / 100) * deck.audio.duration;
  }

  setVolume(volume: number, muted: boolean) {
    this.volume = volume;
    this.muted = muted;
    this.masterGain.gain.setTargetAtTime(muted ? 0 : volume / 100, this.ctx.currentTime, 0.05);
  }

  getCurrentTrack(): DJEngineTrack | null {
    return this.activeDeck.track;
  }

  destroy() {
    this.destroyed = true;
    if (this.pollTimer) window.clearInterval(this.pollTimer);
    for (const deck of this.decks) {
      try { deck.audio.pause(); deck.audio.removeAttribute("src"); } catch { /* ignore */ }
    }
    try { void this.ctx.close(); } catch { /* ignore */ }
  }
}
