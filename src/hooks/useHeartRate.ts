import { useCallback, useRef, useState } from "react";

// Tętno ze smartwatcha / czujnika przez WEB BLUETOOTH — bez instalacji apki.
// Standard BLE Heart Rate Service (0x180D) + Heart Rate Measurement (0x2A37).
// Działa na Chrome (Android / Windows / macOS) z czujnikiem BLE (np. Polar,
// opaski, część zegarków). iOS Safari NIE wspiera Web Bluetooth.
// To realne „tętno ze smartwatcha, które działa tu" — feed do AI DJ (BPM↔serce).
export function useHeartRate() {
  const [bpm, setBpm] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<any>(null);

  const supported = typeof navigator !== "undefined" && !!(navigator as any).bluetooth;

  const connect = useCallback(async () => {
    const nav = navigator as any;
    if (!nav.bluetooth) {
      setError("Ta przeglądarka nie wspiera Bluetooth. Użyj Chrome na Androidzie/komputerze.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const device = await nav.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] });
      deviceRef.current = device;
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService("heart_rate");
      const char = await service.getCharacteristic("heart_rate_measurement");
      await char.startNotifications();
      char.addEventListener("characteristicvaluechanged", (e: any) => {
        const v: DataView = e.target.value;
        const flags = v.getUint8(0);
        const value = (flags & 0x1) ? v.getUint16(1, true) : v.getUint8(1);
        if (value > 20 && value < 260) setBpm(value);
      });
      device.addEventListener("gattserverdisconnected", () => {
        setConnected(false);
        setBpm(null);
      });
      setConnected(true);
    } catch (e: any) {
      if (e?.name !== "NotFoundError") setError(e?.message || "Nie udało się połączyć czujnika.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    try { deviceRef.current?.gatt?.disconnect(); } catch { /* */ }
    setConnected(false);
    setBpm(null);
  }, []);

  return { bpm, connected, connecting, error, supported, connect, disconnect };
}
