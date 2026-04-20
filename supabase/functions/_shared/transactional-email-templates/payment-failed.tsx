/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Link, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'GrouAI Stream'
const SITE_URL = 'https://grouaistream.com'

interface FailedProps {
  displayName?: string
  planName?: string
}

const PaymentFailedEmail = ({ displayName, planName = 'Pro' }: FailedProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Twoja płatność za {SITE_NAME} {planName} się nie powiodła</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={logoIcon}>⚠️</Text>
          <Heading style={h1}>{SITE_NAME}</Heading>
        </Section>

        <Section style={content}>
          <Heading style={h2}>Płatność się nie powiodła</Heading>

          <Text style={text}>Cześć {displayName || 'tam'},</Text>

          <Text style={text}>
            Niestety, nie udało się obciążyć Twojej karty za subskrypcję{' '}
            <strong>{SITE_NAME} {planName}</strong>. Twoje konto zostało tymczasowo
            cofnięte do planu Free, ale wszystkie utwory, playlisty i historia pozostają nietknięte.
          </Text>

          <Section style={alertBox}>
            <Text style={alertTitle}>🔄 Co możesz zrobić?</Text>
            <Text style={alertText}>
              Zaktualizuj metodę płatności w portalu klienta — gdy tylko się uda obciążyć kartę,
              dostęp do funkcji premium wróci natychmiast.
            </Text>
          </Section>

          <Section style={buttonWrap}>
            <Button href={`${SITE_URL}/settings`} style={button}>
              Zaktualizuj płatność
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={smallText}>
            Najczęstsze przyczyny: wygasła karta, brak środków, blokada banku przy płatnościach
            zagranicznych. Jeśli problem się powtarza, napisz do nas — pomożemy.
          </Text>
        </Section>

        <Section style={footer}>
          <Text style={footerText}>
            Pytania? <Link href="mailto:kontakt@grouaistream.com" style={link}>kontakt@grouaistream.com</Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PaymentFailedEmail,
  subject: (data: Record<string, any>) =>
    `⚠️ Płatność za ${SITE_NAME} ${data?.planName || 'Pro'} nie powiodła się`,
  displayName: 'Payment failed',
  previewData: { displayName: 'Anna', planName: 'Pro' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: 0, padding: 0 }
const container = { maxWidth: '560px', margin: '0 auto', padding: '0' }
const headerSection = { backgroundColor: '#0a0a0a', padding: '28px 24px', textAlign: 'center' as const }
const logoIcon = { fontSize: '32px', margin: '0' }
const h1 = { color: '#ff6b1a', fontSize: '24px', fontWeight: 'bold', margin: '8px 0 0', letterSpacing: '-0.5px' }
const content = { padding: '32px 24px' }
const h2 = { color: '#0a0a0a', fontSize: '22px', fontWeight: 'bold', margin: '0 0 16px' }
const text = { color: '#3a3a3a', fontSize: '15px', lineHeight: '1.6', margin: '0 0 16px' }
const alertBox = { backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '16px 18px', borderRadius: '6px', margin: '20px 0' }
const alertTitle = { color: '#991b1b', fontSize: '13px', fontWeight: 'bold', margin: '0 0 6px' }
const alertText = { color: '#3a3a3a', fontSize: '14px', lineHeight: '1.5', margin: '0' }
const buttonWrap = { textAlign: 'center' as const, margin: '24px 0' }
const button = { backgroundColor: '#ff6b1a', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const smallText = { color: '#6b7280', fontSize: '13px', lineHeight: '1.5', margin: '0' }
const footer = { padding: '20px 24px', backgroundColor: '#fafafa', textAlign: 'center' as const }
const footerText = { color: '#6b7280', fontSize: '12px', margin: '0' }
const link = { color: '#ff6b1a', textDecoration: 'underline' }
