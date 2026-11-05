// Tłumaczenia katalogu Grouarock (EN, NL). Polski jest w shopCatalog.ts.
// Import względny, bo plik czyta też serwer (api/shop-checkout → nazwy w Stripe).
import type { ShopProduct } from "./shopCatalog";

type Tr = Pick<ShopProduct, "name" | "cat" | "tag" | "desc" | "use" | "spec">;
type Lang = "pl" | "en" | "nl";

const TEE_EN = ["100% cotton, approx. 180 g/m²", "Unisex fit, sizes S–3XL", "DTG print, washable at 30°C", "GROUAROCK neck label"];
const TEE_NL = ["100% katoen, ca. 180 g/m²", "Unisex pasvorm, maten S–3XL", "DTG-print, wasbaar op 30°C", "GROUAROCK-label in de nek"];
const HOOD_EN = ["Fleece-lined cotton, approx. 320 g/m²", "Unisex fit, sizes S–3XL", "DTG print, vivid colours", "GROUAROCK label"];
const HOOD_NL = ["Katoen met fleece, ca. 320 g/m²", "Unisex pasvorm, maten S–3XL", "DTG-print, felle kleuren", "GROUAROCK-label"];
const CAT = {
  en: { "Odzież": "Clothing", "Dodatki": "Accessories", "Gadżety AI": "AI gadgets", "Dom": "Home" } as Record<string, string>,
  nl: { "Odzież": "Kleding", "Dodatki": "Accessoires", "Gadżety AI": "AI-gadgets", "Dom": "Wonen" } as Record<string, string>,
};
const TAG = {
  en: { "Nowość": "New", "Neon": "Neon", "Graffiti": "Graffiti", "Festiwal": "Festival", "Oversize": "Oversize", "Bestseller": "Bestseller", "Najwyższa marża": "Premium", "Limitowany": "Limited" } as Record<string, string>,
  nl: { "Nowość": "Nieuw", "Neon": "Neon", "Graffiti": "Graffiti", "Festiwal": "Festival", "Oversize": "Oversize", "Bestseller": "Bestseller", "Najwyższa marża": "Premium", "Limitowany": "Gelimiteerd" } as Record<string, string>,
};

type Partial3 = Omit<Tr, "cat" | "tag">;
const EN: Record<string, Partial3> = {
  dropbass: { name: "T-shirt “Drop The Bass”", desc: "White tee with a graffiti DJ behind the decks, neon paint drips and the line “Drop the bass, not your standards”. Big print on the front, small GROUAROCK mark below.", use: "For parties, clubs and every day the bass has to win.", spec: TEE_EN },
  sleeplater: { name: "T-shirt “Sleep Later, Dance Now”", desc: "Black tee with a neon crowd under the lasers and the line “Sleep later, dance now”. The pink and turquoise print pops in a dark club.", use: "For the dancefloor, late-night streams and everything after midnight.", spec: TEE_EN },
  beat: { name: "T-shirt “The Beat Waits For No One”", desc: "White street-art tee. “The beat waits for no one” in orange, turquoise and pink dripping letters, signed DJ GROUAROCK.", use: "Wise words for anyone who is late for their own drop.", spec: TEE_EN },
  goodvibes: { name: "T-shirt “Good Vibes Only”", desc: "Navy tee with a festival stage, fireworks and bubble graffiti. The line: “Good vibes only. Bad bass never.”", use: "For festivals, holidays and every party with a good crew.", spec: TEE_EN },
  "3am": { name: "Hoodie “Made For The 3 AM Crowd”", desc: "Black hoodie with a kangaroo pocket. Graffiti, DJ headphones and “Made for the 3 AM crowd” for those who have the most fun after midnight.", use: "For afterparties, the studio and long nights with music.", spec: HOOD_EN },
  bassluv: { name: "Oversized sweatshirt “Bass Is My Love Language”", desc: "Grey oversized crewneck with a skull wearing headphones, graffiti and an equaliser. The line: “Bass is my love language”.", use: "For gigs, campus and winter evenings.", spec: HOOD_EN },
  zipdance: { name: "Zip hoodie “Live From The Dancefloor”", desc: "Black zip hoodie with a club poster on the front: DJ booth, smoke and lasers. The line “Live from the dancefloor”.", use: "For a night out and festival mornings.", spec: HOOD_EN },
  koszulka: { name: "T-shirt “Groua Sunset”", desc: "White tee with a sunset and a sound wave in warm sunset colours. GROUAROCK logo on the front, “Groua Sunset” below. Relaxed, simple fit for every day and for gigs.", use: "With jeans, under a hoodie or on its own in summer. A classic that goes with everything.", spec: ["100% cotton, approx. 180 g/m²", "Unisex fit, sizes S–3XL", "DTG print, washable at 30°C", "Neck seam with GROUAROCK label"] },
  bluza: { name: "GROUAROCK hoodie", desc: "Black hoodie with a kangaroo pocket. GROUAROCK logo with an orange sound wave embroidered on the chest: small and understated. Thick and warm for autumn and winter.", use: "For music on the go, the studio and late-night streams.", spec: ["Fleece-lined cotton, approx. 320 g/m²", "Double-layer hood with drawstring", "Chest embroidery (left side)", "Sizes S–3XL"] },
  czapka: { name: "GROUAROCK cap", desc: "Black cap with an embroidered GROUAROCK logo and orange equaliser. Six panels, structured front, adjustable strap at the back.", use: "Goes with everything and looks great in gig photos.", spec: ["Cotton twill", "3D embroidery on the front", "Adjustable metal buckle", "One size"] },
  torba: { name: "GROUAROCK cotton tote", desc: "Natural tote with long handles. Black GROUAROCK logo and orange equaliser on the front. Fits a laptop, records and groceries.", use: "For records, shopping and everyday things.", spec: ["100% cotton, ecru", "Approx. 38 × 42 cm", "70 cm handles, shoulder carry", "Washable at 30°C"] },
  plakat: { name: "Poster “Groua Sunset”", desc: "Poster with a flowing aurora above a vinyl record and the GROUAROCK logo. Deep black, neon pink and turquoise. High-quality print, ready for a white frame.", use: "For the studio, a room with speakers or the office.", spec: ["Premium matte paper, 200 g/m²", "Sizes 30×40, 50×70 cm", "Fade-resistant pigment inks", "Frame available (option)"] },
  naklejki: { name: "GROUAROCK sticker pack", desc: "Vinyl sticker pack: cassette, record, headphones and a sound wave with the GROUAROCK logo. For laptops, guitars, helmets and suitcases.", use: "For your gear and instruments.", spec: ["Matte vinyl, UV laminate", "Waterproof and sun-resistant", "5 designs per pack", "Die-cut"] },
  okulary: { name: "GROUAROCK AI glasses", desc: "Glasses with a built-in microphone, speakers by the ears and a camera. Ask a question out loud and hear the answer. They translate conversations live and read text around you.", use: "", spec: ["Voice assistant and live translation", "Directional speakers by the ears", "Clear or sunglass lenses", "Charging case, several hours of use"] },
  asystent: { name: "AI assistant with screen", desc: "Desktop assistant with a round screen that listens, talks, translates and helps. Put it on your desk or in the studio. It shows a face and a sound wave while listening.", use: "", spec: ["Voice chat and translation in several languages", "Round screen with an animated face", "360° speaker with GROUAROCK logo", "Connects to Grouaradio and the app"] },
};
const NL: Record<string, Partial3> = {
  dropbass: { name: "T-shirt “Drop The Bass”", desc: "Wit T-shirt met een graffiti-DJ achter de draaitafels, neon verfdruppels en de tekst “Drop the bass, not your standards”. Grote print op de voorkant, klein GROUAROCK-logo eronder.", use: "Voor feestjes, de club en elke dag waarop de bas moet winnen.", spec: TEE_NL },
  sleeplater: { name: "T-shirt “Sleep Later, Dance Now”", desc: "Zwart T-shirt met een neon publiek onder de lasers en de tekst “Sleep later, dance now”. De roze-turquoise print springt eruit in een donkere club.", use: "Voor de dansvloer, nachtelijke streams en alles na middernacht.", spec: TEE_NL },
  beat: { name: "T-shirt “The Beat Waits For No One”", desc: "Wit T-shirt in streetartstijl. “The beat waits for no one” in oranje, turquoise en roze druipletters, gesigneerd door DJ GROUAROCK.", use: "Wijze woorden voor iedereen die te laat is voor zijn eigen drop.", spec: TEE_NL },
  goodvibes: { name: "T-shirt “Good Vibes Only”", desc: "Marineblauw T-shirt met een festivalpodium, vuurwerk en bubbelgraffiti. De tekst: “Good vibes only. Bad bass never.”", use: "Voor festivals, vakanties en elk feest met een goede crew.", spec: TEE_NL },
  "3am": { name: "Hoodie “Made For The 3 AM Crowd”", desc: "Zwarte hoodie met buidelzak. Graffiti, DJ-koptelefoon en “Made for the 3 AM crowd” voor wie na middernacht het meeste plezier heeft.", use: "Voor de afterparty, de studio en lange nachten met muziek.", spec: HOOD_NL },
  bassluv: { name: "Oversized sweater “Bass Is My Love Language”", desc: "Grijze oversized sweater zonder capuchon met een schedel met koptelefoon, graffiti en een equalizer. De tekst: “Bass is my love language”.", use: "Voor concerten, de campus en winteravonden.", spec: HOOD_NL },
  zipdance: { name: "Vest met rits “Live From The Dancefloor”", desc: "Zwart vest met rits en capuchon en een clubposter op de voorkant: DJ-booth, rook en lasers. De tekst “Live from the dancefloor”.", use: "Voor een avond uit en festivalochtenden.", spec: HOOD_NL },
  koszulka: { name: "T-shirt “Groua Sunset”", desc: "Wit T-shirt met een zonsondergang en een geluidsgolf in warme kleuren. GROUAROCK-logo op de voorkant, “Groua Sunset” eronder. Losse, eenvoudige pasvorm voor elke dag en concerten.", use: "Op een jeans, onder een hoodie of los in de zomer. Een klassieker die overal bij past.", spec: ["100% katoen, ca. 180 g/m²", "Unisex pasvorm, maten S–3XL", "DTG-print, wasbaar op 30°C", "Neknaad met GROUAROCK-label"] },
  bluza: { name: "GROUAROCK hoodie", desc: "Zwarte hoodie met buidelzak. GROUAROCK-logo met oranje geluidsgolf geborduurd op de borst: klein en ingetogen. Dik en warm voor herfst en winter.", use: "Voor muziek onderweg, de studio en nachtelijke streams.", spec: ["Katoen met fleece, ca. 320 g/m²", "Dubbele capuchon met koord", "Borduursel op de borst (links)", "Maten S–3XL"] },
  czapka: { name: "GROUAROCK pet", desc: "Zwarte pet met geborduurd GROUAROCK-logo en oranje equalizer. Zes panelen, verstevigde voorkant, verstelbaar bandje achter.", use: "Past overal bij en staat goed op concertfoto’s.", spec: ["Katoenen twill", "3D-borduursel op de voorkant", "Verstelbaar met metalen gesp", "One size"] },
  torba: { name: "GROUAROCK katoenen tas", desc: "Naturelkleurige tas met lange hengsels. Zwart GROUAROCK-logo en oranje equalizer op de voorkant. Past een laptop, platen en boodschappen.", use: "Voor platen, boodschappen en dagelijkse spullen.", spec: ["100% katoen, ecru", "Ca. 38 × 42 cm", "Hengsels van 70 cm, over de schouder", "Wasbaar op 30°C"] },
  plakat: { name: "Poster “Groua Sunset”", desc: "Poster met een vloeiend noorderlicht boven een vinylplaat en het GROUAROCK-logo. Diep zwart, neonroze en turquoise. Hoogwaardige print, klaar voor een witte lijst.", use: "Voor de studio, een kamer met speakers of het kantoor.", spec: ["Premium mat papier, 200 g/m²", "Formaten 30×40, 50×70 cm", "Pigmentinkt, kleurvast", "Met lijst verkrijgbaar (optie)"] },
  naklejki: { name: "GROUAROCK stickerset", desc: "Set vinylstickers: cassette, plaat, koptelefoon en geluidsgolf met het GROUAROCK-logo. Voor laptop, gitaar, helm en koffer.", use: "Voor je apparatuur en instrumenten.", spec: ["Mat vinyl, UV-laminaat", "Waterdicht en zonbestendig", "5 ontwerpen per set", "Op contour gesneden"] },
  okulary: { name: "GROUAROCK AI-bril", desc: "Bril met ingebouwde microfoon, speakers bij de oren en een camera. Stel hardop een vraag en hoor het antwoord. Vertaalt gesprekken live en leest tekst om je heen voor.", use: "", spec: ["Spraakassistent en live vertaling", "Gerichte speakers bij de oren", "Heldere glazen of zonneglazen", "Opladen in de case, enkele uren gebruik"] },
  asystent: { name: "AI-assistent met scherm", desc: "Bureau-assistent met een rond scherm die luistert, praat, vertaalt en helpt. Zet hem op je bureau of in de studio. Toont een gezicht en een geluidsgolf terwijl hij luistert.", use: "", spec: ["Spraakgesprekken en vertaling in meerdere talen", "Rond scherm met geanimeerd gezicht", "360°-speaker met GROUAROCK-logo", "Verbonden met Grouaradio en de app"] },
};
const BY_LANG = { en: EN, nl: NL };

/** Produkt w danym języku (brak tłumaczenia → polski oryginał). */
export function localizeProduct(p: ShopProduct, lang: Lang): ShopProduct {
  if (lang === "pl") return p;
  const t = BY_LANG[lang][p.id];
  return { ...p, ...(t ?? {}), cat: CAT[lang][p.cat] ?? p.cat, tag: p.tag ? TAG[lang][p.tag] ?? p.tag : "" };
}
