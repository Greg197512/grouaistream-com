// Regulamin sklepu Grouarock (PL / EN / NL). Dane sprzedawcy pochodzą ze zmiennych Vercela
// (GET /api/shop-checkout), więc zmienia się je w panelu, nie w kodzie.
// WERSJA ROBOCZA: tekst wymaga zatwierdzenia przez Grzegorza (L4: prawo).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { LOCALE, SHOP_LANGS, shopLang, type ShopLang } from "@/i18n/shop";
import type { ShopConfig } from "@/lib/shopInvoice";

type Sec = { h: string; p: string[] };
const UPDATED = "2026-11-04";

const TXT: Record<ShopLang, { title: string; updated: string; draft: string; back: string; form: string; formIntro: string; formBody: string[]; secs: Sec[] }> = {
  pl: {
    title: "Regulamin sklepu Grouarock",
    updated: "Obowiązuje od",
    draft: "Dane sprzedawcy nie są jeszcze uzupełnione. Regulamin jest w przygotowaniu.",
    back: "← Wróć do sklepu",
    form: "Wzór formularza odstąpienia od umowy",
    formIntro: "Wypełnij i odeślij ten formularz tylko, jeśli chcesz odstąpić od umowy (możesz też napisać zwykłego e-maila).",
    formBody: ["Adresat: {SELLER}, e-mail: {EMAIL}", "Ja/My(*) niniejszym informuję/informujemy(*) o moim/naszym odstąpieniu od umowy sprzedaży następujących rzeczy(*):", "Numer zamówienia:", "Data zamówienia(*) / odbioru(*):", "Imię i nazwisko konsumenta(-ów):", "Adres konsumenta(-ów):", "Podpis (tylko przy wersji papierowej):", "Data:", "(*) Niepotrzebne skreślić."],
    secs: [
      { h: "1. Sprzedawca", p: ["Sklep internetowy Grouarock pod adresem grouaistream.com/shop prowadzi {SELLER_FULL}.", "Kontakt: {EMAIL}."] },
      { h: "2. Postanowienia ogólne", p: ["Regulamin określa zasady sprzedaży odzieży, dodatków i gadżetów Grouarock na odległość. Dotyczy konsumentów i firm; prawa przyznane konsumentom przysługują też osobie fizycznej kupującej na cele związane z działalnością, jeśli zakup nie ma dla niej charakteru zawodowego.", "Do zakupów potrzebne jest bezpłatne konto Grouaistream (to samo, którego używasz w serwisie)."] },
      { h: "3. Zamówienie i zawarcie umowy", p: ["Wybierz produkty, rozmiar i ilość, podaj adres dostawy, wybierz płatność, zaakceptuj regulamin i kliknij przycisk zamówienia z obowiązkiem zapłaty.", "Umowa zostaje zawarta z chwilą wyświetlenia potwierdzenia zamówienia z jego numerem (np. GR-1A2B3C4D). Potwierdzenie wysyłamy też e-mailem.", "Produkty oznaczone jako przedsprzedaż wysyłamy w terminie podanym przy produkcie; do chwili wysyłki możesz anulować takie zamówienie bez kosztów."] },
      { h: "4. Ceny i płatności", p: ["Ceny podajemy w euro (EUR) i są to ceny końcowe. Sprzedawca korzysta ze zwolnienia z VAT (art. 113 ust. 1 ustawy o VAT), dlatego VAT nie jest doliczany. Koszt dostawy widzisz w koszyku przed złożeniem zamówienia.", "Dostępne płatności: karta i szybkie płatności przez Stripe albo przelew na rachunek sprzedawcy (Revolut). Przy przelewie wpisz numer zamówienia w tytule.", "Zamówienie opłacane przelewem czeka na wpłatę 7 dni. Po tym czasie możemy je anulować."] },
      { h: "5. Dostawa", p: ["Wysyłamy na terenie Unii Europejskiej.", "Czas realizacji wynosi zwykle {DAYS} dni roboczych od zaksięgowania płatności. Część produktów drukujemy na zamówienie u partnera produkcyjnego.", "Przy odbiorze sprawdź przesyłkę. Uszkodzenie w transporcie najlepiej opisz w protokole kuriera i zgłoś nam."] },
      { h: "6. Prawo odstąpienia od umowy (zwrot w 14 dni)", p: ["Konsument może odstąpić od umowy bez podawania przyczyny w ciągu 14 dni od dnia, w którym otrzymał towar (przy kilku paczkach: od otrzymania ostatniej).", "Wystarczy wysłać nam przed upływem terminu jednoznaczne oświadczenie, np. e-mailem na {EMAIL}. Możesz użyć wzoru formularza poniżej.", "Towar odeślij nie później niż 14 dni od odstąpienia. Bezpośredni koszt odesłania ponosi kupujący.", "Zwrócimy wszystkie płatności, także koszt najtańszej oferowanej dostawy, w ciągu 14 dni od otrzymania oświadczenia, tą samą metodą płatności. Możemy wstrzymać zwrot do chwili otrzymania towaru albo dowodu jego odesłania.", "Odpowiadasz za zmniejszenie wartości towaru wynikające z korzystania z niego w sposób wykraczający poza konieczny do stwierdzenia jego charakteru i działania.", "Prawo odstąpienia nie dotyczy rzeczy wykonanych według Twojej specyfikacji lub wyraźnie spersonalizowanych."] },
      { h: "7. Reklamacje (niezgodność towaru z umową)", p: ["Odpowiadamy za zgodność towaru z umową przez 2 lata od dostawy, zgodnie z przepisami kraju konsumenta.", "Reklamację zgłoś na {EMAIL}: numer zamówienia, opis problemu i zdjęcia. Odpowiemy w ciągu 14 dni.", "Możesz żądać naprawy lub wymiany, a gdy to niemożliwe albo nieskuteczne — obniżenia ceny lub odstąpienia od umowy."] },
      { h: "8. Bilet VIP Grouaistream", p: ["Do zakupu możemy dołączyć bezpłatny kod na 30 dni VIP w Grouaistream. To dodatek promocyjny bez wartości pieniężnej, nie podlega wymianie na gotówkę.", "Po odstąpieniu od umowy niewykorzystany kod może zostać unieważniony."] },
      { h: "9. Dane osobowe", p: ["Dane z zamówienia przetwarzamy, aby zrealizować umowę, wystawić fakturę i spełnić obowiązki podatkowe. Szczegóły: polityka prywatności na stronie /legal."] },
      { h: "10. Spory i prawo właściwe", p: ["Zachęcamy do kontaktu e-mailem — większość spraw rozwiązujemy od ręki.", "Konsument może skorzystać z pozasądowych sposobów rozwiązywania sporów (np. rzecznik konsumentów, Inspekcja Handlowa w Polsce, Europejskie Centrum Konsumenckie) albo sądu właściwego według przepisów.", "Umowa podlega prawu kraju sprzedawcy, ale nie pozbawia konsumenta ochrony przepisów kraju jego zwykłego pobytu, których nie można wyłączyć umową."] },
      { h: "11. Zmiany regulaminu", p: ["Zmiany regulaminu nie dotyczą zamówień złożonych przed ich wejściem w życie."] },
    ],
  },
  en: {
    title: "Grouarock shop terms",
    updated: "Effective from",
    draft: "Seller details are not complete yet. These terms are being prepared.",
    back: "← Back to the shop",
    form: "Model withdrawal form",
    formIntro: "Complete and return this form only if you wish to withdraw from the contract (a plain email works too).",
    formBody: ["To: {SELLER}, email: {EMAIL}", "I/We(*) hereby give notice that I/We(*) withdraw from my/our(*) contract of sale of the following goods(*):", "Order number:", "Ordered on(*) / received on(*):", "Name of consumer(s):", "Address of consumer(s):", "Signature (only if this form is sent on paper):", "Date:", "(*) Delete as appropriate."],
    secs: [
      { h: "1. Seller", p: ["The Grouarock online shop at grouaistream.com/shop is operated by {SELLER_FULL}.", "Contact: {EMAIL}."] },
      { h: "2. General", p: ["These terms govern distance sales of Grouarock clothing, accessories and gadgets to consumers and businesses.", "You need a free Grouaistream account to buy (the same one you use on the site)."] },
      { h: "3. Ordering and the contract", p: ["Choose products, size and quantity, enter your delivery address, choose a payment method, accept these terms and click the order button with obligation to pay.", "The contract is concluded when the order confirmation with its number (e.g. GR-1A2B3C4D) is shown. We also send the confirmation by email.", "Pre-order items ship on the date shown on the product page; you can cancel a pre-order free of charge until it ships."] },
      { h: "4. Prices and payment", p: ["Prices are in euro (EUR) and are final prices. The seller is exempt from VAT (Polish small-business exemption, art. 113(1) of the VAT Act), so no VAT is added. Shipping costs are shown in the cart before you order.", "Payment methods: card and instant payments via Stripe, or bank transfer to the seller’s account (Revolut). Use your order number as the transfer reference.", "Orders paid by transfer are held for 7 days. After that we may cancel them."] },
      { h: "5. Delivery", p: ["We ship within the European Union.", "Orders are usually fulfilled within {DAYS} business days after payment is received. Some products are printed on demand by a production partner.", "Please check the parcel on delivery and report any transport damage to us."] },
      { h: "6. Right of withdrawal (14-day returns)", p: ["Consumers may withdraw from the contract without giving a reason within 14 days of receiving the goods (for several parcels: from receipt of the last one).", "Just send us a clear statement before the deadline, e.g. by email to {EMAIL}. You may use the model form below.", "Send the goods back no later than 14 days after withdrawing. You bear the direct cost of returning the goods.", "We refund all payments received, including the cheapest standard delivery cost, within 14 days of receiving your statement, using the same payment method. We may withhold the refund until we receive the goods or proof of return.", "You are liable for any loss in value caused by handling the goods beyond what is necessary to establish their nature and functioning.", "The right of withdrawal does not apply to goods made to your specifications or clearly personalised."] },
      { h: "7. Complaints (lack of conformity)", p: ["We are liable for lack of conformity of the goods for 2 years from delivery, under the law of the consumer’s country.", "Send complaints to {EMAIL} with your order number, a description and photos. We reply within 14 days.", "You may ask for repair or replacement and, if that is impossible or fails, a price reduction or termination of the contract."] },
      { h: "8. Grouaistream VIP ticket", p: ["A purchase may include a free code for 30 days of Grouaistream VIP. It is a promotional bonus with no cash value and cannot be exchanged for money.", "If you withdraw from the contract, an unused code may be cancelled."] },
      { h: "9. Personal data", p: ["We process order data to perform the contract, issue invoices and meet tax obligations. Details: privacy policy at /legal."] },
      { h: "10. Disputes and applicable law", p: ["Please contact us by email first; we solve most issues right away.", "Consumers may use out-of-court dispute resolution bodies (e.g. the European Consumer Centre in their country) or the competent court.", "The contract is governed by the law of the seller’s country, without depriving consumers of the protection of mandatory rules of their country of habitual residence."] },
      { h: "11. Changes", p: ["Changes to these terms do not affect orders placed before they take effect."] },
    ],
  },
  nl: {
    title: "Algemene voorwaarden Grouarock-shop",
    updated: "Geldig vanaf",
    draft: "De gegevens van de verkoper zijn nog niet volledig. Deze voorwaarden worden voorbereid.",
    back: "← Terug naar de shop",
    form: "Modelformulier voor herroeping",
    formIntro: "Vul dit formulier alleen in en stuur het terug als je de overeenkomst wilt herroepen (een gewone e-mail mag ook).",
    formBody: ["Aan: {SELLER}, e-mail: {EMAIL}", "Ik/Wij(*) deel/delen(*) u hierbij mede dat ik/wij(*) onze overeenkomst betreffende de verkoop van de volgende producten herroep/herroepen(*):", "Bestelnummer:", "Besteld op(*) / ontvangen op(*):", "Naam consument(en):", "Adres consument(en):", "Handtekening (alleen bij papieren versie):", "Datum:", "(*) Doorhalen wat niet van toepassing is."],
    secs: [
      { h: "1. Verkoper", p: ["De Grouarock-webshop op grouaistream.com/shop wordt beheerd door {SELLER_FULL}.", "Contact: {EMAIL}."] },
      { h: "2. Algemeen", p: ["Deze voorwaarden gelden voor de verkoop op afstand van Grouarock-kleding, -accessoires en -gadgets aan consumenten en bedrijven.", "Om te kopen heb je een gratis Grouaistream-account nodig (hetzelfde als op de site)."] },
      { h: "3. Bestellen en de overeenkomst", p: ["Kies producten, maat en aantal, vul je bezorgadres in, kies een betaalmethode, ga akkoord met deze voorwaarden en klik op de knop voor een bestelling met betalingsverplichting.", "De overeenkomst komt tot stand zodra de orderbevestiging met bestelnummer (bijv. GR-1A2B3C4D) wordt getoond. We sturen de bevestiging ook per e-mail.", "Pre-orderproducten worden verzonden op de datum bij het product; tot verzending kun je een pre-order kosteloos annuleren."] },
      { h: "4. Prijzen en betaling", p: ["Prijzen zijn in euro (EUR) en zijn eindprijzen. De verkoper is vrijgesteld van btw (Poolse kleineondernemersregeling, art. 113 lid 1 btw-wet), dus er wordt geen btw berekend. Verzendkosten zie je in de winkelwagen vóór je bestelt.", "Betaalmethoden: kaart en directe betalingen via Stripe, of bankoverschrijving naar de rekening van de verkoper (Revolut). Vermeld je bestelnummer als omschrijving.", "Bestellingen per overschrijving wachten 7 dagen op betaling. Daarna kunnen we ze annuleren."] },
      { h: "5. Levering", p: ["We verzenden binnen de Europese Unie.", "Bestellingen worden meestal binnen {DAYS} werkdagen na ontvangst van de betaling verwerkt. Sommige producten worden op bestelling bedrukt door een productiepartner.", "Controleer het pakket bij ontvangst en meld transportschade bij ons."] },
      { h: "6. Herroepingsrecht (14 dagen bedenktijd)", p: ["Consumenten kunnen de overeenkomst zonder opgave van redenen herroepen binnen 14 dagen na ontvangst van het product (bij meerdere pakketten: na ontvangst van het laatste).", "Stuur ons vóór het einde van de termijn een duidelijke verklaring, bijv. per e-mail naar {EMAIL}. Je kunt het modelformulier hieronder gebruiken.", "Stuur het product uiterlijk 14 dagen na de herroeping terug. De directe kosten van het terugzenden zijn voor jou.", "We betalen alle ontvangen betalingen terug, inclusief de goedkoopste standaardverzending, binnen 14 dagen na ontvangst van je verklaring, via dezelfde betaalmethode. We mogen wachten met terugbetalen tot we het product of een bewijs van terugzending hebben ontvangen.", "Je bent aansprakelijk voor waardevermindering door gebruik dat verder gaat dan nodig is om de aard en werking van het product vast te stellen.", "Het herroepingsrecht geldt niet voor producten die volgens jouw specificaties zijn gemaakt of duidelijk gepersonaliseerd zijn."] },
      { h: "7. Klachten (non-conformiteit)", p: ["We staan in voor de conformiteit van het product gedurende 2 jaar na levering, volgens het recht van het land van de consument.", "Stuur klachten naar {EMAIL} met je bestelnummer, een omschrijving en foto’s. We reageren binnen 14 dagen.", "Je kunt herstel of vervanging vragen en, als dat niet mogelijk is of niet lukt, prijsverlaging of ontbinding van de overeenkomst."] },
      { h: "8. Grouaistream VIP-ticket", p: ["Bij een aankoop kan een gratis code voor 30 dagen Grouaistream VIP horen. Dit is een promotionele bonus zonder geldwaarde en kan niet worden ingewisseld voor geld.", "Bij herroeping kan een ongebruikte code worden ingetrokken."] },
      { h: "9. Persoonsgegevens", p: ["We verwerken bestelgegevens om de overeenkomst uit te voeren, facturen op te maken en aan belastingverplichtingen te voldoen. Details: privacybeleid op /legal."] },
      { h: "10. Geschillen en toepasselijk recht", p: ["Neem eerst per e-mail contact met ons op; de meeste zaken lossen we direct op.", "Consumenten kunnen gebruikmaken van buitengerechtelijke geschilbeslechting (bijv. het Europees Consumentencentrum in hun land) of de bevoegde rechter.", "Op de overeenkomst is het recht van het land van de verkoper van toepassing, zonder dat de consument de bescherming verliest van dwingende regels van het land waar hij gewoonlijk woont."] },
      { h: "11. Wijzigingen", p: ["Wijzigingen van deze voorwaarden gelden niet voor bestellingen die daarvóór zijn geplaatst."] },
    ],
  },
};

export default function ShopTerms() {
  const { language, setLanguage } = useLanguage();
  const lang = shopLang(language);
  const t = TXT[lang];
  const [cfg, setCfg] = useState<ShopConfig | null>(null);
  useEffect(() => { fetch("/api/shop-checkout").then((r) => (r.ok ? r.json() : null)).then(setCfg).catch(() => setCfg(null)); }, []);
  useEffect(() => { document.title = `${t.title} | Grouaistream`; document.documentElement.lang = lang; }, [t, lang]);

  const s = cfg?.seller;
  const ids = s ? [s.taxId, s.vatId && s.vatId !== s.taxId ? s.vatId : null].filter(Boolean).join(", ") : "";
  const fill = (x: string) => x
    .replace("{SELLER_FULL}", s ? `${s.name}, ${s.address}${ids ? ` (${ids})` : ""}` : cfg?.contact?.name ?? "—")
    .replace("{SELLER}", s ? `${s.name}, ${s.address}` : cfg?.contact?.name ?? "—")
    .replace(/\{EMAIL\}/g, s?.email ?? cfg?.contact?.email ?? "—")
    .replace("{DAYS}", cfg?.deliveryDays ?? "5–14");

  return (
    <div className="min-h-screen bg-white text-neutral-900" style={{ colorScheme: "light" }}>
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur">
        <Link to="/shop" className="text-sm text-neutral-600 hover:text-neutral-900">{t.back}</Link>
        <div className="flex h-10 items-center rounded-full border border-neutral-300 p-1" role="group" aria-label="Language">
          {SHOP_LANGS.map((l) => <button key={l} type="button" onClick={() => setLanguage(l)} aria-pressed={lang === l} className={`h-8 rounded-full px-3 text-xs font-bold uppercase ${lang === l ? "bg-neutral-900 text-white" : "text-neutral-600"}`}>{l}</button>)}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 leading-relaxed">
        <h1 className="text-4xl font-black leading-tight [text-wrap:balance]">{t.title}</h1>
        <p className="mt-2 text-sm text-neutral-500">{t.updated}: {new Date(UPDATED).toLocaleDateString(LOCALE[lang])}</p>
        {cfg && !s && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t.draft}</p>}
        {t.secs.map((sec) => (
          <section key={sec.h} className="mt-8">
            <h2 className="text-xl font-bold">{sec.h}</h2>
            {sec.p.map((x, i) => <p key={i} className="mt-2 max-w-[68ch] text-neutral-700">{fill(x)}</p>)}
          </section>
        ))}
        <section id="withdrawal-form" className="mt-10 rounded-2xl border border-neutral-200 p-5">
          <h2 className="text-xl font-bold">{t.form}</h2>
          <p className="mt-2 text-sm text-neutral-600">{t.formIntro}</p>
          <ul className="mt-3 space-y-2 text-sm">{t.formBody.map((x, i) => <li key={i}>{fill(x)}</li>)}</ul>
        </section>
      </main>
    </div>
  );
}
