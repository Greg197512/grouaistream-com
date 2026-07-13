// Audio → MIDI w przeglądarce (Spotify Basic Pitch, Apache-2.0). Dla producentów:
// wrzuca wygenerowany utwór do modelu i pobiera plik .mid.
// Ciężkie zależności (TensorFlow.js + model) ładowane LENIWIE — nie obciążają
// głównego bundla i uruchamiają się dopiero po kliknięciu.

export async function audioToMidiDownload(
  url: string,
  filename: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const [bp, midiMod] = await Promise.all([
    import("@spotify/basic-pitch"),
    import("@tonejs/midi"),
  ]);
  const { BasicPitch, addPitchBendsToNoteEvents, noteFramesToTime, outputToNotesPoly } = bp;
  const { Midi } = midiMod;

  // 1) Pobierz i zdekoduj audio
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const arrayBuffer = await r.arrayBuffer();
  const decodeCtx = new AudioContext();
  const decoded = await decodeCtx.decodeAudioData(arrayBuffer);
  void decodeCtx.close();

  // 2) Przepróbkuj do 22050 Hz mono (wymagane przez model)
  const targetRate = 22050;
  const length = Math.ceil(decoded.duration * targetRate);
  const off = new OfflineAudioContext(1, length, targetRate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start(0);
  const monoBuffer = await off.startRendering();

  // 3) Model → ramki/onsety/kontury
  const model = new BasicPitch("/models/basic-pitch/model.json");
  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];
  await model.evaluateModel(
    monoBuffer,
    (f: number[][], o: number[][], c: number[][]) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (p: number) => onProgress?.(p),
  );

  // 4) Nuty (próg onset/frame 0.25, min. długość 5 ramek)
  const notes = noteFramesToTime(
    addPitchBendsToNoteEvents(contours, outputToNotesPoly(frames, onsets, 0.25, 0.25, 5)),
  );
  if (notes.length === 0) throw new Error("Nie wykryto nut w tym nagraniu");

  // 5) Zbuduj plik MIDI
  const midi = new Midi();
  const track = midi.addTrack();
  for (const n of notes) {
    track.addNote({
      midi: n.pitchMidi,
      time: n.startTimeSeconds,
      duration: Math.max(0.05, n.durationSeconds),
      velocity: Math.max(0.1, Math.min(1, n.amplitude)),
    });
  }

  // 6) Pobierz
  const bytes = new Uint8Array(midi.toArray());
  const blob = new Blob([bytes], { type: "audio/midi" });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename.replace(/[\\/:*?"<>|]/g, "_");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
