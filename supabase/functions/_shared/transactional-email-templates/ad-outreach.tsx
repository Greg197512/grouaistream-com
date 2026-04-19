/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'

const HERO_IMAGE_URL = 'https://bvstvawnigyczvofzhps.supabase.co/storage/v1/object/public/email-assets/ad-outreach-hero-v2.jpg'
import type { TemplateEntry } from './registry.ts'

interface Props {
  company_name?: string
  cta_url: string
}

export const AdOutreachEmail = ({ company_name, cta_url }: Props) => {
  const greeting = company_name ? `Witam zespół ${company_name},` : 'Witam serdecznie,'
  return (
    <Html lang="pl" dir="ltr">
      <Head />
      <Preview>Reklama na GrouAI Stream — widoczność na blogu za 5 €</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={heroSection}>
            <Img
              src={HERO_IMAGE_URL}
              alt="GrouAI Stream — AI Music Universe"
              width="600"
              height="300"
              style={heroImage}
            />
          </Section>

          <Section style={contentSection}>
            <Text style={greetingText}>{greeting}</Text>

            <Text style={paragraph}>
              Reprezentuję <strong style={accent}>GrouaRock</strong> — twórców <strong style={accent}>GrouAI Stream</strong>,
              platformy muzycznej nowej generacji dla słuchaczy, twórców i marek szukających realnej widoczności.
            </Text>

            <Text style={paragraph}>
              Proponujemy prostą współpracę: <strong style={accent}>Twoja reklama pojawia się na naszym blogu</strong>,
              a cały proces zajmuje dosłownie chwilę — wypełniasz formularz, publikacja jest gotowa, a potem opłacasz ją jednym przelewem.
            </Text>

            <Hr style={divider} />

            <Heading as="h2" style={offerTitle}>
              Oferta dla {company_name || 'Państwa firmy'}
            </Heading>

            <Section style={priceBox}>
              <Text style={priceLabel}>Cena promocyjna</Text>
              <Text style={priceValue}>5 €</Text>
              <Text style={priceNote}>30 dni emisji · bez abonamentu · bez długiej umowy</Text>
            </Section>

            <Text style={paragraph}>
              Kliknij poniżej, aby od razu otworzyć formularz reklamy:
            </Text>

            <Section style={ctaWrapper}>
              <Link href={cta_url} style={ctaButton}>
                Wrzuć swoją reklamę teraz
              </Link>
            </Section>

            <Text style={smallParagraph}>
              Jeśli przycisk w Twojej skrzynce nie otworzy strony, użyj tego bezpośredniego linku:
            </Text>
            <Link href={cta_url} style={fallbackLink}>{cta_url}</Link>

            <Hr style={divider} />

            <Text style={paragraph}>
              Po wysłaniu formularza zobaczysz dane do płatności, a na email dostaniesz pełne podsumowanie całego zgłoszenia.
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
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const body = { backgroundColor: '#ffffff', color: '#1a1a1f', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', margin: 0, padding: '24px 0' }
const container = { maxWidth: '620px', margin: '0 auto', padding: '0', backgroundColor: '#0f0f17', borderRadius: '24px', overflow: 'hidden' as const }
const heroSection = { padding: 0, margin: 0, lineHeight: 0 }
const heroImage = { width: '100%', height: 'auto', display: 'block', margin: 0 }
const contentSection = { padding: '32px 32px 24px' }
const greetingText = { fontSize: '17px', fontWeight: 600, color: '#ffffff', margin: '0 0 20px' }
const paragraph = { fontSize: '15px', lineHeight: '1.7', color: '#cfcfdc', margin: '0 0 16px' }
const smallParagraph = { fontSize: '13px', lineHeight: '1.6', color: '#9999ad', margin: '8px 0 10px' }
const accent = { color: '#ff6b1a' }
const divider = { borderColor: '#2a2a3a', margin: '28px 0' }
const offerTitle = { fontSize: '22px', fontWeight: 700, color: '#ffffff', margin: '0 0 16px' }
const priceBox = { background: 'linear-gradient(135deg, rgba(255,107,26,0.12) 0%, rgba(255,180,0,0.12) 100%)', border: '1px solid rgba(255,107,26,0.4)', borderRadius: '16px', padding: '24px', textAlign: 'center' as const, margin: '24px 0' }
const priceLabel = { fontSize: '11px', color: '#ff6b1a', textTransform: 'uppercase' as const, letterSpacing: '2px', fontWeight: 700, margin: '0 0 8px' }
const priceValue = { fontSize: '36px', fontWeight: 800, color: '#ffffff', margin: '0 0 4px' }
const priceNote = { fontSize: '12px', color: '#9999ad', margin: 0 }
const ctaWrapper = { textAlign: 'center' as const, margin: '28px 0 16px' }
const ctaButton = { background: '#ff6b1a', color: '#ffffff', padding: '16px 36px', borderRadius: '12px', fontSize: '16px', fontWeight: 700, textDecoration: 'none', display: 'inline-block', boxShadow: '0 8px 24px rgba(255,107,26,0.35)' }
const fallbackLink = { color: '#ff8a3d', textDecoration: 'underline', fontSize: '13px', wordBreak: 'break-all' as const }
const signature = { fontSize: '14px', lineHeight: '1.6', color: '#cfcfdc', margin: '24px 0 0' }
const signatureSub = { fontSize: '12px', color: '#9999ad', fontStyle: 'italic' as const }
const footer = { padding: '24px 32px 32px', textAlign: 'center' as const, borderTop: '1px solid #2a2a3a' }
const footerText = { fontSize: '13px', color: '#9999ad', margin: 0, lineHeight: '1.6' }
const footerLink = { color: '#ff6b1a', textDecoration: 'none' }

export const template: TemplateEntry = {
  component: AdOutreachEmail,
  subject: (data) => `Reklama na GrouAI Stream — 5 € dla ${data.company_name || 'Państwa firmy'}`,
  displayName: 'B2B Outreach — propozycja reklamy',
  previewData: { company_name: 'Café Aurora', cta_url: 'https://grouaistream.com/reklama/sample-token' },
}
