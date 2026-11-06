// Gadżety GrouaDrop: gdzie zamówić u dostawcy (dropshipping / hurt) — widoczne tylko w panelu admina przy zamówieniu.
// Linki prowadzą do wyszukiwania tego typu produktu u sprawdzonych platform; wybierz ofertę z dobrymi opiniami,
// wysyłką z magazynu w UE i (jeśli chcesz) opcją nadruku logo, a w polu adresu wpisz dane klienta z zamówienia.
const q = encodeURIComponent;
const links = (term: string) => [
  { name: "AliExpress", url: `https://www.aliexpress.com/w/wholesale-${q(term).replace(/%20/g, "-")}.html?shipFromCountry=PL` },
  { name: "CJdropshipping", url: `https://cjdropshipping.com/search/${q(term)}.html` },
  { name: "Allegro", url: `https://allegro.pl/listing?string=${q(term)}` },
  { name: "Amazon.de", url: `https://www.amazon.de/s?k=${q(term)}` },
];
export type Sourcing = { term: string; note: string; links: { name: string; url: string }[] };
const S = (term: string, note: string): Sourcing => ({ term, note, links: links(term) });

export const SOURCING: Record<string, Sourcing> = {
  sluchawkianc: S("wireless headphones ANC RGB", "Nauszne, ANC, Bluetooth 5.3+, 40+ h, podświetlenie muszli. Szukaj z magazynem w UE i logo na zamówienie (MOQ)."),
  flipsound: S("headphones speaker 2 in 1 bluetooth", "Słuchawki, które po obróceniu muszli grają jak głośnik. Sprawdź opinie o głośności w trybie głośnika."),
  galaxy: S("galaxy star projector bluetooth speaker", "Projektor gwiazd/mgławicy z głośnikiem BT i pilotem. Wtyczka EU / USB-C."),
  gamepad: S("wireless controller RGB transparent phone clip", "Pad BT/2.4 GHz do PC, Android/iOS, TV (Android TV) z uchwytem na telefon. Bez preinstalowanych gier."),
  clearbuds: S("transparent wireless earbuds LED digital display", "Przezroczyste etui, wyświetlacz baterii, BT 5.3, tryb gry."),
  pixelbox: S("pixel art bluetooth speaker LED display", "Głośnik z ekranem pixel-art (animacje, zegar), ok. 10 h, pasek."),
  okulary: S("AI smart glasses camera translation open ear speakers", "Okulary AI: kamera, głośniki open-ear, tłumaczenie, aplikacja; sprawdź zgodność z RODO (kamera) i certyfikat CE."),
  asystent: S("desktop AI assistant robot round screen speaker", "Asystent biurkowy z okrągłym ekranem (twarz), głośnik, Wi-Fi; aplikacja i język PL."),
  midi25: S("25 key USB MIDI keyboard controller drum pads", "25 klawiszy, 8 padów RGB, pokrętła; USB-C, plug & play (Win/Mac/iPad)."),
};
