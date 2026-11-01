// Katalog sklepu Grouarock. Ceny w EUR (grosze) muszą się zgadzać z supabase/functions/shop-checkout.
export interface ShopProduct { id:string; name:string; cat:string; tag:string; desc:string; use:string; spec:string[]; pln:number; eurCents:number; preorder:boolean; sizes:boolean; video:boolean }
export const SHOP_PRODUCTS: ShopProduct[] = [
 {
  "id": "koszulka",
  "name": "Koszulka „Groua Sunset”",
  "cat": "Odzież",
  "tag": "Bestseller",
  "desc": "Biała koszulka z nadrukiem zachodzącego słońca i fali dźwiękowej w ciepłych kolorach zachodu słońca. Logo GROUAROCK z przodu, napis „Groua Sunset” pod spodem. Luźny, prosty krój na co dzień i na koncert.",
  "use": "Do jeansów, pod bluzę albo solo latem. Pierwszy produkt Dropu 01.",
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
  "sizes": true,
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
   "Połączenie z Grouaradio i Grouaistream"
  ],
  "pln": 429,
  "eurCents": 9900,
  "preorder": true,
  "sizes": false,
  "video": true
 }
];
export const SHOP_ADMIN_EMAIL = "grzegorzkaron553@gmail.com";
