// Wykrywanie słabszego urządzenia + „tryb oszczędny" (low-power).
//
// Cel: na starych/słabych telefonach i komputerach strona ma chodzić PŁYNNIE.
// Największe kosztowne rzeczy to: animowane, mocno rozmyte tła (blur 120px),
// backdrop-filter (szkło) w dziesiątkach miejsc i ciągłe animacje. W trybie
// oszczędnym wyłączamy/redukujemy je — na mocnych urządzeniach zostają.
//
// Ustawiamy atrybut na <html data-lowpower="on|off"> (hak dla CSS) oraz
// udostępniamy isLowPower() dla logiki w komponentach.

let cached: boolean | null = null;

export function isLowPowerDevice(): boolean {
  if (cached !== null) return cached;
  let low = false;
  try {
    const nav = navigator as unknown as {
      deviceMemory?: number;
      hardwareConcurrency?: number;
      connection?: { saveData?: boolean };
    };
    // Save-Data: użytkownik jawnie chce oszczędzać.
    if (nav.connection?.saveData) low = true;
    // Pamięć RAM (Chrome/Android): ≤4 GB = budżetowy/stary sprzęt.
    if (typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 && nav.deviceMemory <= 4) low = true;
    // Liczba rdzeni: ≤4 = słabszy CPU (stare telefony/laptopy).
    if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4) low = true;
    // Użytkownik prosi o mniej ruchu.
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) low = true;
  } catch {
    low = false;
  }
  cached = low;
  return low;
}

// Ustaw znacznik na <html> jak najwcześniej (przed pierwszym malowaniem).
export function applyPerfMode(): void {
  try {
    document.documentElement.setAttribute("data-lowpower", isLowPowerDevice() ? "on" : "off");
  } catch {
    /* ignore */
  }
}
