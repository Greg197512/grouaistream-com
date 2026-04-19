/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
  Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  company_name?: string
  cta_url: string
}

export const AdOutreachEmail = ({ company_name, cta_url }: Props) => {
  const greeting = company_name ? `Witam zespół ${company_name},` : 'Witam serdecznie,'
  return (
    <Html>
      <Head />
      <Preview>Reklama na GrouAI Stream — dotrzyj do tysięcy słuchaczy za 10 € / miesiąc</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Neon header */}
          <Section style={headerSection}>
            <Heading style={brandTitle}>GrouAI Stream</Heading>
            <Text style={brandSub}>by GrouaRock — AI Music Universe</Text>
          </Section>

          <Section style={contentSection}>
            <Text style={greetingText}>{greeting}</Text>

            <Text style={paragraph}>
              Reprezentuję <strong style={accent}>GrouaRock</strong> — twórców <strong style={accent}>GrouAI Stream</strong>,
              platformy muzycznej nowej generacji, która wykracza poza wszystko, co znasz ze Spotify
              czy Apple Music.
            </Text>

            <Text style={paragraph}>
              Budujemy przestrzeń, w której <em>muzyka w końcu zaczyna słuchać użytkownika</em> —
              empatyczne AI rozpoznaje nastrój przez kamerę i głos, generuje utwory w 15 gatunkach,
              prowadzi radio na żywo, miksuje sesje DJ-skie z głosowaniem publiczności i tworzy
              intymne raporty psychologiczne z miesięcy słuchania.
            </Text>

            <Text style={paragraph}>
              Nasi użytkownicy to ludzie kreatywni, otwarci na nowe doświadczenia, świadomi
              technologicznie — kawiarnie, kluby, marki lifestyle, sklepy muzyczne, eventy i
              twórcy szukają właśnie ich.
            </Text>

            <Hr style={divider} />

            <Heading as="h2" style={offerTitle}>
              🎯 Oferta dla {company_name || 'Państwa firmy'}
            </Heading>

            <Text style={paragraph}>
              Proponujemy <strong style={accent}>banner reklamowy z linkiem na naszym blogu</strong> —
              widocznym dla każdego odwiedzającego grouaistream.com. Reklama pojawia się
              automatycznie po wypełnieniu formularza, a Państwo płacą tylko jeśli zdecydują się
              kontynuować.
            </Text>

            <Section style={priceBox}>
              <Text style={priceLabel}>Cena promocyjna</Text>
              <Text style={priceValue}>10 € / miesiąc</Text>
              <Text style={priceNote}>jednorazowy przelew, bez zobowiązań długoterminowych</Text>
            </Section>

            <Section style={ctaWrapper}>
              <Button href={cta_url} style={ctaButton}>
                ▶ Wrzuć swoją reklamę teraz
              </Button>
            </Section>

            <Text style={smallParagraph}>
              Klikając przycisk powyżej, otworzy się bezpieczny formularz, w którym wgrywają
              Państwo treść reklamy oraz dane do przelewu Revolut. Reklama publikuje się
              natychmiast — mają Państwo 24h na opłacenie, w przeciwnym razie zostaje usunięta
              bez konsekwencji.
            </Text>

            <Hr style={divider} />

            <Text style={paragraph}>
              Jeśli mają Państwo pytania, wystarczy odpowiedzieć na ten email — czytamy każdą
              odpowiedź osobiście.
            </Text>

            <Text style={signature}>
              Z pozdrowieniami,<br />
              <strong style={accent}>Zespół GrouaRock</strong><br />
              <span style={signatureSub}>GrouAI Stream — gdzie muzyka patrzy Ci w oczy</span>
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              GrouaRock · GrouAI Stream<br />
              <Link href="https://grouaistream.com" style={footerLink}>grouaistream.com</Link>{' '}
              · <Link href="mailto:kontakt@grouaistream.com" style={footerLink}>kontakt@grouaistream.com</Link>
            </Text>
            <Text style={footerSmall}>
              Otrzymują Państwo ten email jako ofertę współpracy reklamowej.
              Aby nigdy więcej nie otrzymać wiadomości,{' '}
              <Link href="{{unsubscribe_url}}" style={footerLink}>kliknij tutaj</Link>.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ====== Neon cyberpunk styles ======
const body = { backgroundColor: '#0a0a0f', color: '#e6e6f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', margin: 0, padding: 0 }
const container = { maxWidth: '620px', margin: '0 auto', padding: '0', backgroundColor: '#0f0f17' }
const headerSection = { padding: '40px 32px 24px', textAlign: 'center' as const, background: 'linear-gradient(135deg, #ff6b1a 0%, #ff2d75 100%)', borderRadius: '0 0 24px 24px' }
const brandTitle = { fontSize: '32px', fontWeight: 800, color: '#ffffff', margin: '0 0 4px', letterSpacing: '-0.5px' }
const brandSub = { fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: 0, letterSpacing: '1px', textTransform: 'uppercase' as const }
const contentSection = { padding: '32px 32px 16px' }
const greetingText = { fontSize: '17px', fontWeight: 600, color: '#ffffff', margin: '0 0 20px' }
const paragraph = { fontSize: '15px', lineHeight: '1.7', color: '#cfcfdc', margin: '0 0 16px' }
const smallParagraph = { fontSize: '13px', lineHeight: '1.6', color: '#9999ad', margin: '16px 0 0', fontStyle: 'italic' as const }
const accent = { color: '#ff6b1a' }
const divider = { borderColor: '#2a2a3a', margin: '28px 0' }
const offerTitle = { fontSize: '22px', fontWeight: 700, color: '#ffffff', margin: '0 0 16px' }
const priceBox = { background: 'linear-gradient(135deg, rgba(255,107,26,0.12) 0%, rgba(255,45,117,0.12) 100%)', border: '1px solid rgba(255,107,26,0.4)', borderRadius: '16px', padding: '24px', textAlign: 'center' as const, margin: '24px 0' }
const priceLabel = { fontSize: '11px', color: '#ff6b1a', textTransform: 'uppercase' as const, letterSpacing: '2px', fontWeight: 700, margin: '0 0 8px' }
const priceValue = { fontSize: '36px', fontWeight: 800, color: '#ffffff', margin: '0 0 4px' }
const priceNote = { fontSize: '12px', color: '#9999ad', margin: 0 }
const ctaWrapper = { textAlign: 'center' as const, margin: '28px 0 16px' }
const ctaButton = { background: 'linear-gradient(135deg, #ff6b1a, #ff2d75)', color: '#ffffff', padding: '16px 36px', borderRadius: '12px', fontSize: '16px', fontWeight: 700, textDecoration: 'none', display: 'inline-block', boxShadow: '0 8px 24px rgba(255,107,26,0.4)' }
const signature = { fontSize: '14px', lineHeight: '1.6', color: '#cfcfdc', margin: '24px 0 0' }
const signatureSub = { fontSize: '12px', color: '#9999ad', fontStyle: 'italic' as const }
const footer = { padding: '24px 32px 40px', textAlign: 'center' as const, borderTop: '1px solid #2a2a3a', marginTop: '16px' }
const footerText = { fontSize: '13px', color: '#9999ad', margin: '0 0 12px', lineHeight: '1.6' }
const footerSmall = { fontSize: '11px', color: '#6b6b80', margin: 0, lineHeight: '1.6' }
const footerLink = { color: '#ff6b1a', textDecoration: 'none' }

export const template: TemplateEntry = {
  component: AdOutreachEmail,
  subject: (data) => `Reklama na GrouAI Stream — 10 €/mies. dla ${data.company_name || 'Państwa firmy'}`,
  displayName: 'B2B Outreach — propozycja reklamy',
  previewData: { company_name: 'Café Aurora', cta_url: 'https://grouaistream.com/reklama/sample-token' },
}
