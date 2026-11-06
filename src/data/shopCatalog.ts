// Katalog sklepu Grouarock. Ceny w EUR (grosze) muszą się zgadzać z supabase/functions/shop-checkout.
export interface ShopProduct { id:string; name:string; cat:string; tag:string; desc:string; use:string; spec:string[]; pln:number; eurCents:number; preorder:boolean; sizes:boolean; video:boolean;
  /** Zdjęcia z Printful (produkty przeniesione); brak = /shop/{id}-1.jpg, -2.jpg. */ img?: string[];
  /** Rozmiary dostępne w Printful (zamiast domyślnych S–3XL). */ sizeList?: string[];
  /** „Żywy” nadruk na zdjęciu: maska z pliku nadruku + pole nadruku [x, y, szer., wys.] na kwadratowym zdjęciu (0–1). */ fx?: { mask: string; box: [number, number, number, number] } }
/** Zdjęcie produktu nr i (1, 2…): z Printful albo z /public/shop. */
export const productImg = (p: Pick<ShopProduct, "id" | "img">, i = 1): string => (p.img?.length ? p.img[Math.min(i, p.img.length) - 1] : `/shop/${p.id}-${i}.jpg`);
export const SHOP_PRODUCTS: ShopProduct[] = [
{
 "id": "afterhours",
 "name": "Bluza z kapturem „After Hours”",
 "cat": "Nocna zmiana",
 "tag": "Neon",
 "desc": "Czarna bluza z kapturem z neonowym napisem AFTER HOURS, kasetą „Night Shift” i zegarem wskazującym 03:00 w laserowych promieniach. Różowo-błękitny neon jak szyld klubu po północy.",
 "use": "Na afterparty, nocne powroty i chłodne poranki po festiwalu.",
 "spec": [
  "Gildan 18500, 50% bawełna / 50% poliester",
  "Krój unisex, rozmiary S–3XL",
  "Kieszeń kangurka, nadruk DTG z przodu",
  "Drukowane na zamówienie w UE"
 ],
 "pln": 239,
 "eurCents": 5490,
 "preorder": false,
 "sizes": true,
 "fx": {"mask": "/shop/designs/web/after-hours.jpg", "box": [0.355, 0.218, 0.285, 0.377]},
  "video": false,
 "img": [
  "/shop/afterhours-1.jpg",
  "/shop/designs/web/after-hours.jpg"
 ]
},
{
 "id": "plakatnight",
 "name": "Plakat „Night Shift 23:00–06:00”",
 "cat": "Nocna zmiana",
 "tag": "Limitowany",
 "desc": "Plakat z neonowym miastem nocą: uśmiechnięty księżyc, lasery nad dachami i tłum tańczący na wieżowcach. Głęboki fiolet, róż i błękit — jak kadr z rave’u w przyszłości.",
 "use": "Do pokoju, studia i wszędzie tam, gdzie noc trwa dłużej.",
 "spec": [
  "45 × 60 cm (18″ × 24″)",
  "Gruby papier matowy 189 g/m²",
  "Druk cyfrowy, żywe kolory",
  "Bez ramy · drukowane na zamówienie w UE"
 ],
 "pln": 129,
 "eurCents": 2990,
 "preorder": false,
 "sizes": false,
 "fx": {"mask": "/shop/designs/web/night-poster.jpg", "box": [0.2, 0.101, 0.599, 0.698]},
  "video": false,
 "img": [
  "/shop/plakatnight-1.jpg",
  "/shop/designs/web/night-poster.jpg"
 ]
},
{
 "id": "bassdept",
 "name": "Bluza „Bass Dept.”",
 "cat": "Kolekcja Studio",
 "tag": "Nowość",
 "desc": "Czarna bluza bez kaptura z chromowanym napisem BASS DEPT., potężnym głośnikiem i różowymi falami dźwięku. Grafika w stylu plakatu z lat 90. — wyraźna, kolorowa, robi wrażenie z daleka.",
 "use": "Do studia, na koncert i na zimowe wieczory przy konsolecie.",
 "spec": [
  "Gildan 18000, 50% bawełna / 50% poliester",
  "Krój unisex, rozmiary S–3XL",
  "Nadruk DTG z przodu",
  "Drukowane na zamówienie w UE"
 ],
 "pln": 215,
 "eurCents": 4990,
 "preorder": false,
 "sizes": true,
 "fx": {"mask": "/shop/designs/web/bass-department.jpg", "box": [0.345, 0.16, 0.321, 0.445]},
  "video": false,
 "img": [
  "/shop/bassdept-1.jpg",
  "/shop/designs/web/bass-department.jpg"
 ]
},
{
 "id": "louder",
 "name": "Koszulka „Louder Than Words”",
 "cat": "Kolekcja Studio",
 "tag": "Nowość",
 "desc": "Czarna koszulka z pękającym od basu napisem LOUDER, kolumną głośnikową i pomarańczowymi falami uderzeniowymi. Rastrowa faktura jak z sitodruku.",
 "use": "Na co dzień i na każdy koncert, na którym muzyka mówi głośniej niż słowa.",
 "spec": [
  "Bella + Canvas 3001, 100% bawełna czesana",
  "Krój unisex, rozmiary S–3XL",
  "Nadruk DTG z przodu",
  "Drukowane na zamówienie w UE"
 ],
 "pln": 129,
 "eurCents": 2990,
 "preorder": false,
 "sizes": true,
 "fx": {"mask": "/shop/designs/web/louder.jpg", "box": [0.337, 0.168, 0.336, 0.451]},
  "video": false,
 "img": [
  "/shop/louder-1.jpg",
  "/shop/designs/web/louder.jpg"
 ]
},
{
 "id": "nightshift",
 "name": "Tank top „Night Shift Raver”",
 "cat": "Nocna zmiana",
 "tag": "Neon",
 "desc": "Czarny tank top z neonowym napisem NIGHT SHIFT, sylwetką DJ-a za konsolą i laserami w różu i błękicie. „Clocking in at 23:00” — dla tych, co zaczynają, gdy inni kończą.",
 "use": "Na rave, festiwale i letnie noce na parkiecie.",
 "spec": [
  "Bella + Canvas 3480, 100% bawełna",
  "Krój unisex, rozmiary S–XXL",
  "Nadruk DTG z przodu",
  "Drukowane na zamówienie w UE"
 ],
 "pln": 119,
 "eurCents": 2790,
 "preorder": false,
 "sizes": true,
 "fx": {"mask": "/shop/designs/web/night-shift.jpg", "box": [0.201, 0.108, 0.585, 0.716]},
  "video": false,
 "img": [
  "/shop/nightshift-1.jpg",
  "/shop/designs/web/night-shift.jpg"
 ],
 "sizeList": [
  "S",
  "M",
  "L",
  "XL",
  "XXL"
 ]
},
{
 "id": "kubekbeats",
 "name": "Kubek „Coffee. Beats. Repeat.”",
 "cat": "Kolekcja Studio",
 "tag": "Nowość",
 "desc": "Biały błyszczący kubek z hasłem COFFEE. BEATS. REPEAT. i filiżanką, z której para zamienia się w korektor dźwięku i płyty winylowe. Nadruk dookoła.",
 "use": "Na poranną kawę w studiu i długie sesje przy bitach.",
 "spec": [
  "Ceramika, 330 ml (11 oz)",
  "Można myć w zmywarce i używać w mikrofalówce",
  "Nadruk sublimacyjny, nie ściera się",
  "Drukowane na zamówienie w UE"
 ],
 "pln": 79,
 "eurCents": 1790,
 "preorder": false,
 "sizes": false,
 "video": false,
 "img": [
  "/shop/kubekbeats-3.jpg",
  "/shop/kubekbeats-1.jpg",
  "/shop/designs/web/mug-beats.jpg"
 ]
},
{
 "id": "etuieq",
 "name": "Etui na iPhone „Equalizer”",
 "cat": "Nocna zmiana",
 "tag": "Neon",
 "desc": "Wytrzymałe etui z neonowym korektorem dźwięku w kolorach od złota po fiolet — jak miasto nocą zbudowane z dźwięku. Błyszczące wykończenie.",
 "use": "Ochrona telefonu i mała scena w kieszeni.",
 "spec": [
  "Podwójna warstwa: poliwęglan + TPU",
  "Modele iPhone 11–17",
  "Ładowanie bezprzewodowe działa",
  "Drukowane na zamówienie w UE"
 ],
 "pln": 109,
 "eurCents": 2490,
 "preorder": false,
 "sizes": true,
 "fx": {"mask": "/shop/designs/web/phone-eq.jpg", "box": [0.31, 0.148, 0.375, 0.752]},
  "video": false,
 "img": [
  "/shop/etuieq-1.jpg",
  "/shop/designs/web/phone-eq.jpg"
 ],
 "sizeList": [
  "iPhone 13",
  "iPhone 14",
  "iPhone 15",
  "iPhone 15 Pro",
  "iPhone 15 Pro Max",
  "iPhone 16",
  "iPhone 16 Pro",
  "iPhone 16 Pro Max",
  "iPhone 17",
  "iPhone 17 Pro",
  "iPhone 17 Pro Max"
 ]
},
{
 "id": "padstudio",
 "name": "Podkładka „Studio Mode: On”",
 "cat": "Kolekcja Studio",
 "tag": "Nowość",
 "desc": "Podkładka pod mysz dla producentów: STUDIO MODE: ON, czerwona kropka REC, 128 BPM i świecąca fala dźwięku nad suwakami miksera.",
 "use": "Na biurko w studiu i przy komputerze do grania.",
 "spec": [
  "22 × 18 cm, grubość 3 mm",
  "Gumowy, antypoślizgowy spód",
  "Nadruk sublimacyjny",
  "Drukowane na zamówienie w UE"
 ],
 "pln": 75,
 "eurCents": 1690,
 "preorder": false,
 "sizes": false,
 "fx": {"mask": "/shop/designs/web/mat-studio-pad.jpg", "box": [0.045, 0.13, 0.905, 0.74]},
  "video": false,
 "img": [
  "/shop/padstudio-1.jpg",
  "/shop/designs/web/mat-studio-pad.jpg"
 ]
},
 {
 "id": "sluchawkianc",
 "name": "Słuchawki ANC „Pulse Pro”",
 "cat": "Gadżety",
 "tag": "Hit 2026",
 "desc": "Bezprzewodowe słuchawki nauszne z aktywną redukcją szumów (ANC) i trybem otoczenia. Miękkie poduszki z pianki memory, składany pałąk i świecące pierścienie LED na muszlach w kolorach pomarańczu i różu. Łączą się z dwoma urządzeniami naraz (telefon + laptop) i grają do kilkudziesięciu godzin na jednym ładowaniu.",
 "use": "Do pociągu, samolotu, nauki i nocnych sesji muzycznych — wyciszasz świat jednym przyciskiem.",
 "spec": [
  "Aktywna redukcja szumów (ANC) + tryb otoczenia",
  "Bluetooth 5.3, multipoint (2 urządzenia)",
  "Do 40–60 h odtwarzania (zależnie od trybu i ANC)",
  "Szybkie ładowanie USB-C, kabel AUX w zestawie",
  "Mikrofony do rozmów, sterowanie przyciskami",
  "Podświetlenie LED na muszlach (można wyłączyć)",
  "Zdjęcie poglądowe — wygląd i logo mogą się nieznacznie różnić"
 ],
 "pln": 349,
 "eurCents": 7990,
 "preorder": true,
 "sizes": false,
 "video": false,
 "img": [
  "/shop/sluchawkianc-1.jpg",
  "/shop/sluchawkianc-2.jpg"
 ]
},
{
 "id": "flipsound",
 "name": "Słuchawki-głośnik 2w1 „FlipSound”",
 "cat": "Gadżety",
 "tag": "Nowość",
 "desc": "Nowość z targów CES 2026: słuchawki, które po obróceniu muszli na zewnątrz zamieniają się w przenośny głośnik Bluetooth. Słuchasz sam w drodze, a na imprezie jednym ruchem puszczasz muzykę wszystkim. Grafitowe wykończenie i błękitne pierścienie LED.",
 "use": "Dla tych, co raz słuchają w samotności, a raz robią imprezę — jeden sprzęt zamiast dwóch.",
 "spec": [
  "Tryb słuchawek i tryb głośnika (obrót muszli)",
  "Bluetooth 5.3, zasięg ok. 10 m",
  "Do ok. 30 h w słuchawkach, krócej w trybie głośnika",
  "Ładowanie USB-C",
  "Wbudowany mikrofon do rozmów",
  "Składana konstrukcja, etui w zestawie",
  "Zdjęcie poglądowe — wygląd i logo mogą się nieznacznie różnić"
 ],
 "pln": 429,
 "eurCents": 9990,
 "preorder": true,
 "sizes": false,
 "video": false,
 "img": [
  "/shop/flipsound-1.jpg",
  "/shop/flipsound-2.jpg"
 ]
},
{
 "id": "galaxy",
 "name": "Projektor galaktyki z głośnikiem „Aurora Sky”",
 "cat": "Gadżety",
 "tag": "Hit TikTok",
 "desc": "Zamień sufit w nocne niebo: projektor wyświetla ruchomą mgławicę w fiolecie, różu i turkusie oraz tysiące gwiazd. Ma wbudowany głośnik Bluetooth — światło może pulsować w rytm muzyki. Sterujesz pilotem: kolory, jasność, prędkość i wyłącznik czasowy.",
 "use": "Do sypialni, pokoju gier i na domówkę — klimat klubu albo spokojne zasypianie pod gwiazdami.",
 "spec": [
  "Projekcja mgławicy + gwiazd (laser/LED)",
  "Głośnik Bluetooth, tryb światła w rytm muzyki",
  "Pilot: kolory, jasność, prędkość obrotu",
  "Wyłącznik czasowy (np. 1–2 h)",
  "Zasilanie USB-C (zasilacz w zestawie lub USB)",
  "Zasięg projekcji ok. 15–30 m² sufitu",
  "Zdjęcie poglądowe — wygląd i logo mogą się nieznacznie różnić"
 ],
 "pln": 169,
 "eurCents": 3990,
 "preorder": true,
 "sizes": false,
 "video": false,
 "img": [
  "/shop/galaxy-1.jpg",
  "/shop/galaxy-2.jpg"
 ]
},
{
 "id": "gamepad",
 "name": "Pad do gier „GameBeat” RGB",
 "cat": "Gadżety",
 "tag": "Nowość",
 "desc": "Bezprzewodowy pad w przezroczystej, dymionej obudowie z podświetleniem RGB. Gra na PC, telefonie (Android/iOS), tablecie i telewizorze z Android TV — z rozkładanym uchwytem na telefon do gier w chmurze i mobilnych. Bez preinstalowanych gier: grasz w swoje, legalnie kupione tytuły i usługi chmurowe.",
 "use": "Do kanapowego grania na TV, gier w chmurze na telefonie i wyścigów na PC.",
 "spec": [
  "Bluetooth + odbiornik 2,4 GHz w zestawie",
  "Zgodność: PC (Windows), Android, iOS, Android TV",
  "Uchwyt na telefon 4,7–6,9″",
  "Wibracje, żyroskop, przyciski programowalne",
  "Akumulator ok. 15–20 h, ładowanie USB-C",
  "Podświetlenie RGB z kilkoma trybami",
  "Zdjęcie poglądowe — wygląd i logo mogą się nieznacznie różnić"
 ],
 "pln": 189,
 "eurCents": 4490,
 "preorder": true,
 "sizes": false,
 "video": false,
 "img": [
  "/shop/gamepad-1.jpg",
  "/shop/gamepad-2.jpg"
 ]
},
{
 "id": "midi25",
 "name": "Klawiatura MIDI „BeatPad 25”",
 "cat": "Gadżety",
 "tag": "Dla producentów",
 "desc": "Kompaktowa klawiatura sterująca dla producentów: 25 dynamicznych klawiszy, 8 świecących padów perkusyjnych RGB, pokrętła i suwaki do miksu. Podłączasz jednym kablem USB-C i od razu działa w Ableton, FL Studio, GarageBand i w naszym Studio GrouAI w przeglądarce.",
 "use": "Do tworzenia bitów, nagrywania melodii i grania na żywo — mieści się w plecaku obok laptopa.",
 "spec": [
  "25 dynamicznych mini-klawiszy",
  "8 padów RGB czułych na siłę uderzenia",
  "Pokrętła i suwaki MIDI do przypisania",
  "USB-C, plug & play (Windows, macOS, iPad)",
  "Działa w Ableton, FL Studio, GarageBand, Studio GrouAI",
  "Wejście na pedał sustain (zależnie od modelu)",
  "Zdjęcie poglądowe — wygląd i logo mogą się nieznacznie różnić"
 ],
 "pln": 299,
 "eurCents": 6990,
 "preorder": true,
 "sizes": false,
 "video": false,
 "img": [
  "/shop/midi25-1.jpg",
  "/shop/midi25-2.jpg"
 ]
},
{
  "id": "dropbass",
  "name": "Koszulka „Drop The Bass”",
  "cat": "Odzież",
  "tag": "Nowość",
  "desc": "Biała koszulka z graffiti-DJ-em za konsoletą, neonowymi kroplami farby i hasłem „Drop the bass, not your standards”. Wielki napis z przodu, mały znak GROUAROCK pod spodem.",
  "use": "Na imprezę, do klubu i na każdy dzień, kiedy bas ma wygrać.",
  "spec": [
   "Bawełna 100%, ok. 180 g/m²",
   "Krój unisex, rozmiary S–3XL",
   "Nadruk DTG, odporny na pranie w 30°C",
   "Metka GROUAROCK na karku"
  ],
  "pln": 129,
  "eurCents": 2990,
  "preorder": false,
  "sizes": true,
  "video": false
 },
 {
  "id": "sleeplater",
  "name": "Koszulka „Sleep Later, Dance Now”",
  "cat": "Odzież",
  "tag": "Neon",
  "desc": "Czarna koszulka z neonowym tłumem pod laserami i hasłem „Sleep later, dance now”. Różowo-turkusowy nadruk świeci w ciemności klubu.",
  "use": "Na parkiet, nocne streamy i wszystko po północy.",
  "spec": [
   "Bawełna 100%, ok. 180 g/m²",
   "Krój unisex, rozmiary S–3XL",
   "Nadruk DTG, odporny na pranie w 30°C",
   "Metka GROUAROCK na karku"
  ],
  "pln": 129,
  "eurCents": 2990,
  "preorder": false,
  "sizes": true,
  "video": false
 },
 {
  "id": "beat",
  "name": "Koszulka „The Beat Waits For No One”",
  "cat": "Odzież",
  "tag": "Graffiti",
  "desc": "Biała koszulka w stylu street art. Napis „The beat waits for no one” w pomarańczowo-turkusowo-różowych literach z kroplami farby i podpisem DJ GROUAROCK.",
  "use": "Mądra sentencja dla każdego, kto spóźnia się na własny drop.",
  "spec": [
   "Bawełna 100%, ok. 180 g/m²",
   "Krój unisex, rozmiary S–3XL",
   "Nadruk DTG, odporny na pranie w 30°C",
   "Metka GROUAROCK na karku"
  ],
  "pln": 129,
  "eurCents": 2990,
  "preorder": false,
  "sizes": true,
  "video": false
 },
 {
  "id": "goodvibes",
  "name": "Koszulka „Good Vibes Only”",
  "cat": "Odzież",
  "tag": "Festiwal",
  "desc": "Granatowa koszulka ze sceną festiwalową, fajerwerkami i bąblowym graffiti. Hasło: „Good vibes only. Bad bass never.”",
  "use": "Na festiwal, wakacje i każdą imprezę z dobrą ekipą.",
  "spec": [
   "Bawełna 100%, ok. 180 g/m²",
   "Krój unisex, rozmiary S–3XL",
   "Nadruk DTG, odporny na pranie w 30°C",
   "Metka GROUAROCK na karku"
  ],
  "pln": 129,
  "eurCents": 2990,
  "preorder": false,
  "sizes": true,
  "video": false
 },
 {
  "id": "3am",
  "name": "Bluza „Made For The 3 AM Crowd”",
  "cat": "Odzież",
  "tag": "Nowość",
  "desc": "Czarna bluza z kapturem i kieszenią kangurką. Graffiti, słuchawki DJ-a i napis „Made for the 3 AM crowd” dla tych, którzy najlepiej bawią się po północy.",
  "use": "Na after, studio i długie noce z muzyką.",
  "spec": [
   "Bawełna z polarem, ok. 320 g/m²",
   "Kroje unisex, rozmiary S–3XL",
   "Nadruk DTG, intensywne kolory",
   "Metka GROUAROCK"
  ],
  "pln": 279,
  "eurCents": 6490,
  "preorder": false,
  "sizes": true,
  "video": false
 },
 {
  "id": "bassluv",
  "name": "Bluza oversize „Bass Is My Love Language”",
  "cat": "Odzież",
  "tag": "Oversize",
  "desc": "Szara bluza oversize bez kaptura z czaszką w słuchawkach, graffiti i equalizerem. Hasło: „Bass is my love language”.",
  "use": "Na koncert, na uczelnię i na zimowe wieczory.",
  "spec": [
   "Bawełna z polarem, ok. 320 g/m²",
   "Kroje unisex, rozmiary S–3XL",
   "Nadruk DTG, intensywne kolory",
   "Metka GROUAROCK"
  ],
  "pln": 249,
  "eurCents": 5790,
  "preorder": false,
  "sizes": true,
  "video": false
 },
 {
  "id": "zipdance",
  "name": "Bluza rozpinana „Live From The Dancefloor”",
  "cat": "Odzież",
  "tag": "Nowość",
  "desc": "Czarna bluza rozpinana z kapturem i klubowym plakatem na froncie: kabina DJ-a, dym i lasery. Napis „Live from the dancefloor”.",
  "use": "Na wyjście do klubu i festiwalowe poranki.",
  "spec": [
   "Bawełna z polarem, ok. 320 g/m²",
   "Kroje unisex, rozmiary S–3XL",
   "Nadruk DTG, intensywne kolory",
   "Metka GROUAROCK"
  ],
  "pln": 299,
  "eurCents": 6990,
  "preorder": false,
  "sizes": true,
  "video": false
 },
 {
  "id": "koszulka",
  "name": "Koszulka „Groua Sunset”",
  "cat": "Odzież",
  "tag": "Bestseller",
  "desc": "Biała koszulka z nadrukiem zachodzącego słońca i fali dźwiękowej w ciepłych kolorach zachodu słońca. Logo GROUAROCK z przodu, napis „Groua Sunset” pod spodem. Luźny, prosty krój na co dzień i na koncert.",
  "use": "Do jeansów, pod bluzę albo solo latem. Klasyk, który pasuje do wszystkiego.",
  "spec": [
   "Bawełna 100%, ok. 180 g/m²",
   "Krój unisex, rozmiary S–3XL",
   "Nadruk DTG, odporny na pranie w 30°C",
   "Szwy na karku z metką GROUAROCK"
  ],
  "pln": 129,
  "eurCents": 2990,
  "preorder": false,
  "sizes": true,
  "video": true
 },
 {
  "id": "bluza",
  "name": "Bluza z kapturem GROUAROCK",
  "cat": "Odzież",
  "tag": "Najwyższa marża",
  "desc": "Czarna bluza z kapturem i kieszenią kangurką. Logo GROUAROCK z pomarańczową falą dźwiękową haftowane na piersi, mały znak, bez krzyku. Gruba, ciepła, na jesień i zimę.",
  "use": "Do słuchania muzyki w drodze, do studia, na streamy nocne.",
  "spec": [
   "Bawełna z polarem, ok. 320 g/m²",
   "Kaptur podwójny ze sznurkiem",
   "Haft na piersi (lewa strona)",
   "Rozmiary S–3XL"
  ],
  "pln": 279,
  "eurCents": 6490,
  "preorder": false,
  "sizes": true,
  "video": true
 },
 {
  "id": "czapka",
  "name": "Czapka z daszkiem GROUAROCK",
  "cat": "Odzież",
  "tag": "",
  "desc": "Czarna czapka z haftowanym logo GROUAROCK z pomarańczowym equalizerem. Sześć paneli, wzmocniony przód, regulowany pasek z tyłu.",
  "use": "Pasuje do wszystkiego i dobrze wygląda na zdjęciach z koncertów.",
  "spec": [
   "Bawełna twill",
   "Haft 3D na froncie",
   "Regulacja z metalową klamrą",
   "Rozmiar uniwersalny"
  ],
  "pln": 149,
  "eurCents": 3490,
  "preorder": false,
  "sizes": false,
  "video": true
 },
 {
  "id": "torba",
  "name": "Torba bawełniana GROUAROCK",
  "cat": "Dodatki",
  "tag": "",
  "desc": "Naturalna torba z długimi uchwytami. Czarne logo GROUAROCK i pomarańczowy equalizer na froncie. Mieści laptop, winyle i zakupy.",
  "use": "Na płyty, zakupy i codzienne rzeczy.",
  "spec": [
   "Bawełna 100%, kolor ecru",
   "Wymiary ok. 38 × 42 cm",
   "Uchwyty 70 cm, noszenie na ramieniu",
   "Do prania w 30°C"
  ],
  "pln": 99,
  "eurCents": 2290,
  "preorder": false,
  "sizes": false,
  "video": true
 },
 {
  "id": "plakat",
  "name": "Plakat „Groua Sunset”",
  "cat": "Dom",
  "tag": "Limitowany",
  "desc": "Plakat z płynącą aurorą nad winylem i logo GROUAROCK. Głęboka czerń, neonowy róż i turkus. Wydruk w wysokiej jakości, gotowy do wstawienia w białą ramę.",
  "use": "Do studia, pokoju z głośnikami albo biura.",
  "spec": [
   "Papier matowy premium, 200 g/m²",
   "Formaty 30×40, 50×70 cm",
   "Tusze pigmentowe, odporne na blaknięcie",
   "Dostępny w ramie (opcja)"
  ],
  "pln": 85,
  "eurCents": 1990,
  "preorder": false,
  "sizes": false,
  "video": true
 },
 {
  "id": "naklejki",
  "name": "Zestaw naklejek GROUAROCK",
  "cat": "Dodatki",
  "tag": "",
  "desc": "Zestaw naklejek winylowych: kaseta, płyta, słuchawki i fala dźwiękowa z logo GROUAROCK. Do laptopa, gitary, kasku i walizki.",
  "use": "Do oklejania sprzętu i instrumentów.",
  "spec": [
   "Winyl matowy, laminat UV",
   "Wodoodporne, odporne na słońce",
   "5 wzorów w zestawie",
   "Wycięte po konturze"
  ],
  "pln": 42,
  "eurCents": 990,
  "preorder": false,
  "sizes": false,
  "video": false
 },
 {
  "id": "okulary",
  "name": "Okulary AI GROUAROCK",
  "cat": "Gadżety AI",
  "tag": "",
  "desc": "Okulary z wbudowanym mikrofonem, głośnikami przy uszach i kamerą. Zadajesz pytanie głosem, dostajesz odpowiedź w uchu. Tłumaczą rozmowę na bieżąco i czytają napisy z otoczenia.",
  "use": "",
  "spec": [
   "Asystent głosowy i tłumaczenie na żywo",
   "Głośniki kierunkowe przy uszach",
   "Opcja szkieł przezroczystych i przeciwsłonecznych",
   "Ładowanie w etui, kilka godzin pracy"
  ],
  "pln": 649,
  "eurCents": 14900,
  "preorder": true,
  "sizes": false,
  "video": true
 },
 {
  "id": "asystent",
  "name": "Asystent AI z ekranem",
  "cat": "Gadżety AI",
  "tag": "",
  "desc": "Stołowy asystent z okrągłym ekranem, który słucha, rozmawia, tłumaczy i pomaga. Stawiasz go na biurku albo w studiu. Wyświetla twarz i falę dźwięku, gdy słucha.",
  "use": "",
  "spec": [
   "Rozmowa głosowa i tłumaczenie w kilku językach",
   "Okrągły ekran z animowaną twarzą",
   "Głośnik 360° z logo GROUAROCK",
   "Połączenie z Grouaradio i aplikacją"
  ],
  "pln": 429,
  "eurCents": 9900,
  "preorder": true,
  "sizes": false,
  "video": true
 }
];
export const SHOP_ADMIN_EMAIL = "grzegorzkaron553@gmail.com";
