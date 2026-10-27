import { useEffect, useRef, useState } from "react";
import { connectMidi, midiSupported, type MidiEvent } from "@/lib/daw/instruments";

/** Kontroler MIDI dla okna studia — zdarzenia trafiają tylko do aktywnego okna (żeby dwa instrumenty nie grały naraz). */
export function useMidi(active: boolean, onEvent: (e: MidiEvent) => void) {
  const [devices, setDevices] = useState<string[]>([]);
  const [error, setError] = useState("");
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!midiSupported()) { setError("Ta przeglądarka nie obsługuje MIDI — użyj Chrome, Edge albo Opery."); return; }
    let stop: (() => void) | null = null;
    let cancelled = false;
    connectMidi((e) => { if (activeRef.current) handler.current(e); }, setDevices)
      .then((s) => { if (cancelled) s(); else stop = s; })
      .catch(() => setError("Brak zgody na MIDI — zezwól w ustawieniach strony i odśwież."));
    return () => { cancelled = true; stop?.(); };
  }, []);

  return { devices, error, supported: midiSupported() };
}
