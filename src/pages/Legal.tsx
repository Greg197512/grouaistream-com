import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, FileText, Scale, Cookie, Copyright, Globe } from "lucide-react";

const Legal = () => {
  return (
    <MainLayout>
      <div className="px-6 py-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Scale className="h-8 w-8 text-primary" />
          <h1 className="font-display text-3xl font-bold">Dokumenty prawne</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          GrouAI Stream działa w pełni legalnie i zgodnie z obowiązującym prawem UE, RODO oraz międzynarodowymi regulacjami dotyczącymi praw autorskich.
        </p>

        <Tabs defaultValue="terms" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 mb-6">
            <TabsTrigger value="terms" className="gap-1 text-xs"><FileText className="h-3 w-3" />Regulamin</TabsTrigger>
            <TabsTrigger value="privacy" className="gap-1 text-xs"><Shield className="h-3 w-3" />Prywatność</TabsTrigger>
            <TabsTrigger value="copyright" className="gap-1 text-xs"><Copyright className="h-3 w-3" />Prawa autorskie</TabsTrigger>
            <TabsTrigger value="cookies" className="gap-1 text-xs"><Cookie className="h-3 w-3" />Cookies</TabsTrigger>
            <TabsTrigger value="gdpr" className="gap-1 text-xs"><Globe className="h-3 w-3" />RODO</TabsTrigger>
          </TabsList>

          {/* REGULAMIN */}
          <TabsContent value="terms">
            <div className="groove-card p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Regulamin korzystania z serwisu GrouAI Stream</h2>
              </div>
              <p className="text-xs text-muted-foreground">Ostatnia aktualizacja: 28 lutego 2026 r.</p>

              <Section title="§1. Postanowienia ogólne">
                <p>1. Niniejszy Regulamin określa zasady korzystania z platformy muzycznej GrouAI Stream (dalej: „Serwis").</p>
                <p>2. Serwis jest prowadzony przez GrouaRock — projekt w fazie przedrejestracyjnej, z planowaną siedzibą w Holandii. Rejestracja w Izbie Handlowej (Kamer van Koophandel, KvK) nastąpi po osiągnięciu wystarczającej bazy użytkowników. Do tego momentu Serwis działa jako projekt indywidualny na zasadach eenmanszaak (jednoosobowa działalność gospodarcza wg prawa holenderskiego).</p>
                <p>3. Korzystanie z Serwisu oznacza akceptację niniejszego Regulaminu oraz Polityki Prywatności.</p>
              </Section>

              <Section title="§2. Status prawny i rejestracja">
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/20 mb-3">
                  <p className="font-semibold text-accent text-sm">📋 Informacja o statusie rejestracyjnym</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    GrouaRock znajduje się obecnie w fazie rozwojowej (pre-launch). Formalna rejestracja w KvK 
                    oraz uzyskanie numeru BTW (VAT) nastąpi zgodnie z holenderskim prawem handlowym po spełnieniu 
                    progów rejestracyjnych, uzależnionych od liczby aktywnych użytkowników i obrotów.
                  </p>
                </div>
                <p>1. Niniejszy Regulamin stanowi wiążącą umowę pomiędzy użytkownikiem a operatorem Serwisu, niezależnie od statusu rejestracyjnego podmiotu.</p>
                <p>2. Operator zobowiązuje się do formalnej rejestracji działalności gospodarczej w KvK po osiągnięciu progu 500 aktywnych użytkowników lub 10 000 EUR rocznego obrotu — zgodnie z wymogami prawa holenderskiego.</p>
                <p>3. Regulamin, Polityka Prywatności oraz pozostałe dokumenty prawne będą aktualizowane wraz z postępem rejestracji. O każdej istotnej zmianie użytkownicy zostaną poinformowani z co najmniej 14-dniowym wyprzedzeniem drogą mailową.</p>
                <p>4. Do momentu formalnej rejestracji, operator ponosi pełną odpowiedzialność osobistą za działanie Serwisu zgodnie z art. 6:162 Burgerlijk Wetboek (holenderski kodeks cywilny).</p>
              </Section>

              <Section title="§3. Usługi">
                <p>1. Serwis umożliwia: odtwarzanie muzyki z legalnych źródeł, tworzenie playlist, korzystanie z rekomendacji AI, import metadanych muzycznych.</p>
                <p>2. Wszystkie treści udostępniane w Serwisie pochodzą z legalnych źródeł, w tym: utwory na licencji Creative Commons (CC Mixter), materiały przesłane przez użytkowników z odpowiednimi prawami, oraz osadzone treści z YouTube zgodnie z YouTube API Terms of Service.</p>
                <p>3. Serwis nie przechowuje ani nie dystrybuuje nielegalnych kopii utworów chronionych prawem autorskim.</p>
              </Section>

              <Section title="§4. Konto użytkownika">
                <p>1. Rejestracja wymaga podania adresu e-mail i hasła.</p>
                <p>2. Użytkownik jest odpowiedzialny za bezpieczeństwo swojego konta.</p>
                <p>3. Konta mogą zostać zawieszone w przypadku naruszenia Regulaminu.</p>
              </Section>

              <Section title="§5. Utwory generowane przez AI (Suno i inne)">
                <p>1. GrouAI Stream umożliwia wprowadzanie utworów wygenerowanych za pomocą narzędzi AI, takich jak Suno, Udio, AIVA i inne platformy generatywne.</p>
                <p>2. Użytkownik przesyłający utwór wygenerowany przez AI oświadcza, że:</p>
                <p className="pl-4">a) utwór został stworzony indywidualnie na jego koncie w danym serwisie AI,</p>
                <p className="pl-4">b) posiada prawo do dystrybucji utworu zgodnie z warunkami licencji platformy generatywnej (np. Suno Pro/Premier umożliwia komercyjne wykorzystanie),</p>
                <p className="pl-4">c) udziela GrouAI Stream wyłącznej, bezterminowej licencji na odtwarzanie, udostępnianie i przetwarzanie utworu w ramach Serwisu,</p>
                <p className="pl-4">d) utwór nie narusza praw autorskich osób trzecich, nie jest plagiatem ani kopią istniejącego chronionego utworu.</p>
                <p>3. Zgodnie z obecnym stanem prawnym UE (stanowisko EUIPO oraz Dyrektywa DSM 2019/790), utwory w pełni wygenerowane przez AI nie podlegają ochronie prawnoautorskiej w tradycyjnym rozumieniu, gdyż brak jest ludzkiego twórcy. Jednakże użytkownik, który dokonał twórczego wkładu (prompt engineering, aranżacja, selekcja, modyfikacja), może posiadać prawa pokrewne do rezultatu.</p>
                <p>4. GrouAI Stream nie rości sobie praw autorskich do utworów wygenerowanych przez AI — prawa pozostają po stronie osoby, która je przesłała i udzieliła licencji.</p>
                <p>5. W przypadku sporu dotyczącego praw do utworu AI, stosuje się procedurę DMCA/NTD opisaną w §6.</p>
              </Section>

              <Section title="§6. Ograniczenie odpowiedzialności">
                <p>1. Serwis jest udostępniany „tak jak jest" (as-is). Nie gwarantujemy nieprzerwanej dostępności.</p>
                <p>2. Nie ponosimy odpowiedzialności za treści przesłane przez użytkowników.</p>
                <p>3. Zastrzegamy prawo do usunięcia treści naruszających prawa autorskie na podstawie zgłoszeń DMCA/NTD.</p>
              </Section>

              <Section title="§7. Prawo właściwe">
                <p>1. Regulamin podlega prawu holenderskiemu.</p>
                <p>2. Spory rozstrzygane są przez sąd właściwy dla siedziby operatora lub jego miejsca zamieszkania (do czasu formalnej rejestracji).</p>
              </Section>

              <Section title="§8. Zmiany Regulaminu">
                <p>1. Operator zastrzega sobie prawo do zmiany niniejszego Regulaminu w związku ze zmianą statusu rejestracyjnego, rozwojem funkcjonalności Serwisu lub zmianami prawnymi.</p>
                <p>2. O zmianach użytkownicy zostaną powiadomieni z 14-dniowym wyprzedzeniem. Dalsze korzystanie z Serwisu po tym terminie oznacza akceptację zmian.</p>
              </Section>
            </div>
          </TabsContent>

          {/* POLITYKA PRYWATNOŚCI */}
          <TabsContent value="privacy">
            <div className="groove-card p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Polityka Prywatności</h2>
              </div>
              <p className="text-xs text-muted-foreground">Ostatnia aktualizacja: 28 lutego 2026 r.</p>

              <Section title="1. Administrator danych">
                <p>Administratorem danych osobowych jest GrouaRock, Holandia. Kontakt: privacy@grouai.stream</p>
              </Section>

              <Section title="2. Zakres zbieranych danych">
                <p>Zbieramy następujące dane: adres e-mail (rejestracja), nazwę wyświetlaną (opcjonalnie), historię słuchania (za zgodą), preferencje nastrojowe (za zgodą), dane biometryczne z kamery/mikrofonu (wyłącznie za wyraźną zgodą użytkownika).</p>
              </Section>

              <Section title="3. Cel przetwarzania danych">
                <p>Dane są przetwarzane w celu: świadczenia usług platformy, personalizacji rekomendacji muzycznych AI, analizy nastrojów (opcjonalnie), poprawy jakości usług.</p>
              </Section>

              <Section title="4. Podstawa prawna">
                <p>Przetwarzanie odbywa się na podstawie: zgody użytkownika (art. 6 ust. 1 lit. a RODO), wykonania umowy (art. 6 ust. 1 lit. b RODO), prawnie uzasadnionego interesu administratora (art. 6 ust. 1 lit. f RODO).</p>
              </Section>

              <Section title="5. Okres przechowywania">
                <p>Dane są przechowywane przez okres korzystania z konta. Po usunięciu konta wszystkie dane osobowe są usuwane w ciągu 30 dni.</p>
              </Section>

              <Section title="6. Prawa użytkownika">
                <p>Każdy użytkownik ma prawo do: dostępu do swoich danych, sprostowania danych, usunięcia danych („prawo do bycia zapomnianym"), ograniczenia przetwarzania, przenoszenia danych, wniesienia sprzeciwu, cofnięcia zgody w dowolnym momencie.</p>
              </Section>

              <Section title="7. Bezpieczeństwo">
                <p>Stosujemy szyfrowanie TLS/SSL, bezpieczne przechowywanie haseł (bcrypt), anonimizację danych analitycznych, regularne audyty bezpieczeństwa.</p>
              </Section>

              <Section title="8. Przekazywanie danych">
                <p>Dane mogą być przekazywane do podmiotów trzecich wyłącznie w celu realizacji usług (np. hosting, analityka), na podstawie odpowiednich umów powierzenia przetwarzania danych, zgodnie ze Standardowymi Klauzulami Umownymi (SCC).</p>
              </Section>
            </div>
          </TabsContent>

          {/* PRAWA AUTORSKIE */}
          <TabsContent value="copyright">
            <div className="groove-card p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Copyright className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Polityka praw autorskich i licencji</h2>
              </div>
              <p className="text-xs text-muted-foreground">Ostatnia aktualizacja: 28 lutego 2026 r.</p>

              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 mb-4">
                <p className="font-semibold text-primary flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Oświadczenie o legalności
                </p>
                <p className="text-sm mt-2">
                  GrouAI Stream działa w pełni zgodnie z prawem. Wszystkie treści muzyczne pochodzą z legalnych źródeł
                  i są udostępniane na podstawie odpowiednich licencji lub w ramach dozwolonego użytku.
                </p>
              </div>

              <Section title="Źródła treści muzycznych">
                <p><strong>1. Creative Commons (CC Mixter)</strong> — Główne źródło treści. Utwory udostępniane na licencjach CC (BY, BY-NC, BY-SA, BY-NC-SA). Każdy utwór posiada wyświetlaną atrybucję zgodnie z wymogami licencji.</p>
                <p><strong>2. YouTube Embed (IFrame API)</strong> — Osadzanie treści z YouTube odbywa się wyłącznie poprzez oficjalne YouTube IFrame Player API. Jest to zgodne z YouTube Terms of Service (Sekcja 6.B). Nie pobieramy, nie kopiujemy ani nie przechowujemy treści wideo/audio z YouTube.</p>
                <p><strong>3. Treści przesłane przez użytkowników</strong> — Użytkownicy mogą przesyłać wyłącznie utwory, do których posiadają prawa autorskie lub odpowiednią licencję. W przypadku zgłoszenia naruszenia stosujemy procedurę DMCA/Notice-and-Takedown.</p>
                <p><strong>4. Import metadanych (Spotify API)</strong> — Importujemy wyłącznie metadane (tytuł, artysta, album, okładka) za pośrednictwem oficjalnego Spotify Web API. Nie pobieramy ani nie odtwarzamy plików audio ze Spotify. Import odbywa się za zgodą użytkownika poprzez OAuth 2.0.</p>
                <p><strong>5. Utwory AI (Suno, Udio, AIVA i inne)</strong> — Utwory wygenerowane przez platformy AI i przesłane przez użytkowników z odpowiednią licencją (np. Suno Pro/Premier). Użytkownik udziela GrouAI Stream wyłącznej licencji na odtwarzanie i udostępnianie. Utwory AI nie naruszają praw autorskich osób trzecich, gdyż są generowane algorytmicznie na indywidualne zamówienie użytkownika. Zgodnie ze stanowiskiem EUIPO i holenderskim Auteurswet, twórczy wkład użytkownika (prompt, selekcja, modyfikacja) może stanowić podstawę praw pokrewnych.</p>
              </Section>

              <Section title="Procedura zgłaszania naruszeń (DMCA/NTD)">
                <p>Jeśli uważasz, że Twoje prawa autorskie zostały naruszone, skontaktuj się z nami: dmca@grouai.stream</p>
                <p>Zgłoszenie powinno zawierać: identyfikację chronionego utworu, wskazanie lokalizacji naruszenia w Serwisie, dane kontaktowe zgłaszającego, oświadczenie o dobrej wierze.</p>
                <p>Zobowiązujemy się do rozpatrzenia zgłoszenia w ciągu 48 godzin roboczych.</p>
              </Section>

              <Section title="Podstawy prawne">
                <p>• Dyrektywa 2001/29/WE (InfoSoc) — dozwolony użytek, osadzanie treści</p>
                <p>• Dyrektywa 2019/790 (DSM) — art. 17, odpowiedzialność platform</p>
                <p>• DMCA (Digital Millennium Copyright Act) — procedura Notice-and-Takedown</p>
                <p>• Ustawa o prawie autorskim i prawach pokrewnych (Auteurswet, Holandia)</p>
                <p>• YouTube API Terms of Service — zasady osadzania</p>
                <p>• Spotify Developer Terms of Service — zasady korzystania z API</p>
                <p>• Suno Terms of Service — licencja na komercyjne użycie utworów AI (plany Pro/Premier)</p>
                <p>• Stanowisko EUIPO ws. AI-generated content — status prawnoautorski treści generowanych przez AI</p>
              </Section>
            </div>
          </TabsContent>

          {/* COOKIES */}
          <TabsContent value="cookies">
            <div className="groove-card p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Cookie className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Polityka cookies</h2>
              </div>
              <p className="text-xs text-muted-foreground">Ostatnia aktualizacja: 28 lutego 2026 r.</p>

              <Section title="1. Czym są pliki cookies?">
                <p>Pliki cookies to małe pliki tekstowe przechowywane w przeglądarce użytkownika.</p>
              </Section>

              <Section title="2. Jakie cookies stosujemy?">
                <p><strong>Niezbędne</strong> — wymagane do działania Serwisu (sesja logowania, preferencje). Podstawa: art. 6 ust. 1 lit. f RODO.</p>
                <p><strong>Funkcjonalne</strong> — zapamiętywanie ustawień (np. głośność, tryb ciemny). Podstawa: zgoda użytkownika.</p>
                <p><strong>Analityczne</strong> — anonimowa analiza użytkowania (nie stosujemy Google Analytics ani trackerów reklamowych). Podstawa: zgoda użytkownika.</p>
              </Section>

              <Section title="3. Cookies podmiotów trzecich">
                <p>Osadzone treści YouTube mogą ustawiać własne cookies zgodnie z polityką Google. Szczegóły: policies.google.com/privacy</p>
              </Section>

              <Section title="4. Zarządzanie cookies">
                <p>Użytkownik może w każdej chwili usunąć lub zablokować cookies w ustawieniach przeglądarki. Zablokowanie cookies niezbędnych może ograniczyć funkcjonalność Serwisu.</p>
              </Section>
            </div>
          </TabsContent>

          {/* RODO / GDPR */}
          <TabsContent value="gdpr">
            <div className="groove-card p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Informacja o przetwarzaniu danych osobowych (RODO)</h2>
              </div>
              <p className="text-xs text-muted-foreground">Zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r.</p>

              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 mb-4">
                <p className="font-semibold text-primary">✅ Pełna zgodność z RODO</p>
                <p className="text-sm mt-2">
                  GrouAI Stream przetwarza dane osobowe wyłącznie zgodnie z RODO. Jako firma z siedzibą w Holandii (UE),
                  podlegamy bezpośrednio pod europejskie przepisy o ochronie danych osobowych.
                </p>
              </div>

              <Section title="Twoje prawa (art. 15-22 RODO)">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { right: "Prawo dostępu", art: "art. 15", desc: "Możesz zażądać kopii swoich danych" },
                    { right: "Prawo do sprostowania", art: "art. 16", desc: "Możesz poprawić nieprawidłowe dane" },
                    { right: "Prawo do usunięcia", art: "art. 17", desc: "Prawo do bycia zapomnianym" },
                    { right: "Prawo do ograniczenia", art: "art. 18", desc: "Ograniczenie przetwarzania danych" },
                    { right: "Prawo do przenoszenia", art: "art. 20", desc: "Eksport danych w formacie CSV/JSON" },
                    { right: "Prawo do sprzeciwu", art: "art. 21", desc: "Sprzeciw wobec przetwarzania" },
                  ].map(item => (
                    <div key={item.art} className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="font-medium text-sm">{item.right} <span className="text-muted-foreground">({item.art})</span></p>
                      <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Dane biometryczne (art. 9 RODO)">
                <p>Funkcje analizy twarzy (wykrywanie nastrojów) i analizy głosu są <strong>domyślnie wyłączone</strong>. Aktywacja wymaga wyraźnej zgody użytkownika. Dane biometryczne są przetwarzane lokalnie w przeglądarce i nie są przesyłane na serwer. Użytkownik może cofnąć zgodę w każdym momencie w Ustawieniach → AI & Prywatność.</p>
              </Section>

              <Section title="Organ nadzorczy">
                <p>Autoriteit Persoonsgegevens (AP) — Holenderski Urząd Ochrony Danych Osobowych</p>
                <p>www.autoriteitpersoonsgegevens.nl</p>
                <p>Każdy użytkownik ma prawo złożyć skargę do organu nadzorczego.</p>
              </Section>

              <Section title="Kontakt z Inspektorem Ochrony Danych">
                <p>E-mail: dpo@grouai.stream</p>
                <p>Odpowiadamy na zapytania w ciągu 30 dni kalendarzowych, zgodnie z art. 12 ust. 3 RODO.</p>
              </Section>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="font-semibold text-base mb-2">{title}</h3>
    <div className="text-sm text-muted-foreground space-y-2">{children}</div>
  </div>
);

export default Legal;
