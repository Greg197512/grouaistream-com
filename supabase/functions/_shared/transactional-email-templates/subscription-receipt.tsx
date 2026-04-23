/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Link, Button, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'GrouAI Stream'
const SITE_URL = 'https://grouaistream.com'

interface ReceiptProps {
  displayName?: string
  planName?: string         // "Pro" | "Ultimate"
  cycleLabel?: string       // "miesięcznie" | "rocznie"
  amount?: number           // 9.99
  currency?: string         // "EUR" | "USD" | "PLN"
  billedAt?: string         // ISO date
  transactionId?: string    // Paddle txn id
  invoiceUrl?: string       // PDF invoice
  nextBilledAt?: string | null
}

const fmtMoney = (amount?: number, currency = 'USD') => {
  if (amount == null) return '—'
  try {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: currency.toUpperCase() }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`
  }
}
const fmtDate = (iso?: string | null) => {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' }).format(new Date(iso))
  } catch {
    return iso
  }
}

const SubscriptionReceiptEmail = ({
  displayName, planName = 'Pro', cycleLabel, amount, currency = 'USD',
  billedAt, transactionId, invoiceUrl, nextBilledAt,
}: ReceiptProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Potwierdzenie płatności {planName} — {fmtMoney(amount, currency)}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={logoIcon}>⚡</Text>
          <Heading style={h1}>{SITE_NAME}</Heading>
        </Section>

        <Section style={content}>
          <Heading style={h2}>Dziękujemy! Płatność zaksięgowana ✅</Heading>

          <Text style={text}>Cześć {displayName || 'tam'},</Text>

          <Text style={text}>
            Potwierdzamy zaksięgowanie płatności za plan <strong>GrouAI Stream {planName}</strong>
            {cycleLabel ? <> ({cycleLabel})</> : null}. Twoje konto ma już pełen dostęp.
          </Text>

          <Section style={infoBox}>
            <Text style={infoTitle}>Podsumowanie zamówienia</Text>

            <Row style={rowStyle}>
              <Column style={cellLabel}>Plan</Column>
              <Column style={cellValue}>GrouAI Stream {planName}</Column>
            </Row>
            {cycleLabel && (
              <Row style={rowStyle}>
                <Column style={cellLabel}>Cykl</Column>
                <Column style={cellValue}>{cycleLabel}</Column>
              </Row>
            )}
            <Row style={rowStyle}>
              <Column style={cellLabel}>Kwota</Column>
              <Column style={cellValueStrong}>{fmtMoney(amount, currency)}</Column>
            </Row>
            <Row style={rowStyle}>
              <Column style={cellLabel}>Data</Column>
              <Column style={cellValue}>{fmtDate(billedAt)}</Column>
            </Row>
            {nextBilledAt && (
              <Row style={rowStyle}>
                <Column style={cellLabel}>Następna płatność</Column>
                <Column style={cellValue}>{fmtDate(nextBilledAt)}</Column>
              </Row>
            )}
            <Row style={rowStyle}>
              <Column style={cellLabel}>ID transakcji</Column>
              <Column style={cellValueMono}>{transactionId || '—'}</Column>
            </Row>
          </Section>

          {invoiceUrl && (
            <Section style={buttonWrap}>
              <Button href={invoiceUrl} style={button}>Pobierz fakturę PDF</Button>
            </Section>
          )}

          <Section style={buttonWrap}>
            <Button href={`${SITE_URL}/orders`} style={buttonSecondary}>Historia zamówień</Button>
          </Section>

          <Hr style={hr} />

          <Text style={smallText}>
            Płatność obsługuje <strong>Paddle</strong> jako Merchant of Record. Faktura VAT jest dostępna
            w panelu Paddle (link wyżej) oraz w historii zamówień na stronie. Subskrypcję możesz zarządzać
            w <Link href={`${SITE_URL}/settings`} style={link}>Ustawieniach konta</Link>.
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
  component: SubscriptionReceiptEmail,
  subject: (data: Record<string, any>) =>
    `Potwierdzenie płatności — GrouAI Stream ${data?.planName || 'Pro'}`,
  displayName: 'Subscription receipt',
  previewData: {
    displayName: 'Anna',
    planName: 'Pro',
    cycleLabel: 'miesięcznie',
    amount: 9.99,
    currency: 'EUR',
    billedAt: new Date().toISOString(),
    nextBilledAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    transactionId: 'txn_01h1vjes1y163xfj1rh1tkfb65',
    invoiceUrl: 'https://example.com/invoice.pdf',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: 0, padding: 0 }
const container = { maxWidth: '560px', margin: '0 auto', padding: '0' }
const headerSection = { backgroundColor: '#0a0a0a', padding: '28px 24px', textAlign: 'center' as const }
const logoIcon = { fontSize: '32px', margin: '0' }
const h1 = { color: '#ff6b1a', fontSize: '24px', fontWeight: 'bold', margin: '8px 0 0', letterSpacing: '-0.5px' }
const content = { padding: '32px 24px' }
const h2 = { color: '#0a0a0a', fontSize: '22px', fontWeight: 'bold', margin: '0 0 16px' }
const text = { color: '#3a3a3a', fontSize: '15px', lineHeight: '1.6', margin: '0 0 16px' }
const infoBox = { backgroundColor: '#fff7ed', borderLeft: '4px solid #ff6b1a', padding: '16px 18px', borderRadius: '6px', margin: '20px 0' }
const infoTitle = { color: '#9a3412', fontSize: '12px', fontWeight: 'bold', margin: '0 0 12px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const rowStyle = { borderBottom: '1px solid #fde7d3' }
const cellLabel = { color: '#6b7280', fontSize: '13px', padding: '8px 0', width: '40%' }
const cellValue = { color: '#0a0a0a', fontSize: '14px', padding: '8px 0', textAlign: 'right' as const }
const cellValueStrong = { color: '#0a0a0a', fontSize: '16px', fontWeight: 'bold', padding: '8px 0', textAlign: 'right' as const }
const cellValueMono = { color: '#3a3a3a', fontSize: '11px', fontFamily: 'monospace', padding: '8px 0', textAlign: 'right' as const, wordBreak: 'break-all' as const }
const buttonWrap = { textAlign: 'center' as const, margin: '12px 0' }
const button = { backgroundColor: '#ff6b1a', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }
const buttonSecondary = { backgroundColor: '#0a0a0a', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const smallText = { color: '#6b7280', fontSize: '13px', lineHeight: '1.5', margin: '0' }
const footer = { padding: '20px 24px', backgroundColor: '#fafafa', textAlign: 'center' as const }
const footerText = { color: '#6b7280', fontSize: '12px', margin: '0' }
const link = { color: '#ff6b1a', textDecoration: 'underline' }
