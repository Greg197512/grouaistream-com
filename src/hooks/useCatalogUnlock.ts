import { useCallback, useEffect, useState } from "react";

/**
 * Klucz do pełnego katalogu (te ~20 tys. utworów, w tym ukryte).
 * Domyślnie katalog jest ZAMKNIĘTY — widać tylko wybraną część.
 * Po wpisaniu kodu odblokowuje się cała reszta. Kod dajesz tylko wybranym.
 *
 * Stan trzymamy w localStorage, więc odblokowanie zostaje na danym urządzeniu,
 * dopóki ktoś nie kliknie kłódki (zamknięcie) — dokładnie „jak kiedyś było".
 * Zmiana synchronizuje się na żywo między kłódką w pasku a listą utworów.
 */
export const CATALOG_ACCESS_CODE = "00008";

const STORAGE_KEY = "grouai-catalog-key";
const EVENT = "grouai-catalog-unlock-change";

// Stan współdzielony w pamięci — działa nawet, gdy localStorage jest zablokowany
// (tryb prywatny), a przez EVENT synchronizuje wszystkie instancje hooka na żywo.
let memUnlocked = false;

function readUnlocked(): boolean {
  if (memUnlocked) return true;
  try {
    if (localStorage.getItem(STORAGE_KEY) === CATALOG_ACCESS_CODE) {
      memUnlocked = true;
      return true;
    }
  } catch {
    /* brak dostępu do storage */
  }
  return false;
}

export function useCatalogUnlock() {
  const [unlocked, setUnlocked] = useState<boolean>(readUnlocked);

  useEffect(() => {
    const sync = () => setUnlocked(readUnlocked());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync); // inne karty
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Zwraca true, jeśli kod poprawny.
  const unlock = useCallback((code: string): boolean => {
    const ok = code.trim() === CATALOG_ACCESS_CODE;
    if (ok) {
      memUnlocked = true;
      try {
        localStorage.setItem(STORAGE_KEY, CATALOG_ACCESS_CODE);
      } catch {
        /* brak dostępu do storage — działa dalej w pamięci */
      }
      window.dispatchEvent(new Event(EVENT));
      setUnlocked(true);
    }
    return ok;
  }, []);

  // Kliknięcie kłódki gdy odblokowane → zamknij dostęp (świeci na czerwono).
  const lock = useCallback(() => {
    memUnlocked = false;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* zignoruj */
    }
    window.dispatchEvent(new Event(EVENT));
    setUnlocked(false);
  }, []);

  return { unlocked, unlock, lock };
}
