// Przewoźnicy sklepu: wybór w koszyku, numer przesyłki w panelu admina → link do śledzenia u przewoźnika (klient i e-mail).
// Ceny dostawy: zmienna Vercel SHOP_CARRIER_PRICES (JSON w eurocentach, np. {"inpost":1290,"dhl":1690}),
// brak wpisu = SHOP_SHIPPING_EUR_CENTS (domyślnie 0 — darmowa dostawa).
export type CarrierId = "inpost" | "inpost_courier" | "dhl" | "poczta" | "dpd" | "gls" | "ups";
export type Carrier = {
  id: CarrierId; name: string; logo: string;
  /** null = cała UE */
  countries: string[] | null;
  /** wymaga kodu punktu odbioru (Paczkomat) */
  point?: boolean;
  track: (n: string) => string;
};

const q = encodeURIComponent;
const inpostTrack = (n: string) => `https://inpost.pl/sledzenie-przesylek?number=${q(n)}`;

export const CARRIERS: Carrier[] = [
  { id: "inpost", name: "InPost Paczkomat®", logo: "📦", countries: ["PL"], point: true, track: inpostTrack },
  { id: "inpost_courier", name: "Kurier InPost", logo: "🚚", countries: ["PL"], track: inpostTrack },
  { id: "dhl", name: "DHL", logo: "🟨", countries: null, track: (n) => `https://www.dhl.com/pl-pl/home/sledzenie-przesylek.html?tracking-id=${q(n)}` },
  { id: "poczta", name: "Poczta Polska", logo: "📮", countries: null, track: (n) => `https://emonitoring.poczta-polska.pl/?numer=${q(n)}` },
  { id: "dpd", name: "DPD", logo: "🟥", countries: null, track: (n) => `https://tracktrace.dpd.com.pl/parcelDetails?p1=${q(n)}` },
  { id: "gls", name: "GLS", logo: "🟦", countries: null, track: (n) => `https://gls-group.com/PL/pl/sledzenie-paczek?match=${q(n)}` },
  { id: "ups", name: "UPS", logo: "🟫", countries: null, track: (n) => `https://www.ups.com/track?tracknum=${q(n)}` },
];

export const INPOST_MAP_URL = "https://inpost.pl/znajdz-paczkomat";
export const carrierById = (id: unknown): Carrier | undefined => CARRIERS.find((c) => c.id === id);
export const carriersFor = (country: string): Carrier[] => CARRIERS.filter((c) => !c.countries || c.countries.includes(country.toUpperCase()));
/** Kod Paczkomatu, np. KRA01M, WAW123A. */
export const isPointCode = (s: string) => /^[A-Z]{3}\d{2,4}[A-Z]{0,3}$/i.test(s.trim());
export const trackingUrl = (carrier: unknown, number: string): string | null => {
  const c = carrierById(carrier);
  return c && number.trim() ? c.track(number.trim()) : null;
};
