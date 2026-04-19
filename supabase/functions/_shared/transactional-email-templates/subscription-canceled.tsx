/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Link, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'GrouAI Stream'
const SITE_URL = 'https://grouaistream.com'

interface CancelProps {
  displayName?: string
  periodEnd?: string
  isReminder?: boolean
}

function formatDate(iso?: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('pl-PL', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return iso }
}

const SubscriptionCanceledEmail = ({ displayName, periodEnd, isReminder }: CancelProps) => {
  const niceDate = formatDate(periodEnd)
  return (
    <Html lang="pl" dir="ltr">
      <Head />
      <Preview>
        {isReminder
          ? `Twój dostęp do ${SITE_NAME} kończy się ${niceDate}`
          : `Potwierdzamy anulowanie subskrypcji ${SITE_NAME}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Text style={logoIcon}>🎵</Text>
            <Heading style={h1}>{SITE_NAME}</Heading>
          </Section>

          <Section style={content}>
            <Heading style={h2}>
              {isReminder ? 'Twój dostęp wygasa jutro' : 'Subskrypcja anulowana'}
            </Heading>

            <Text style={text}>
              Cześć {displayName || 'tam'},
            </Text>

            <Text style={text}>
              {isReminder ? (
                <>
                  Przypominamy, że Twoja subskrypcja {SITE_NAME} wygaśnie{' '}
                  <strong>{niceDate}</strong>. Po tej dacie Twoje konto wróci do planu Free —
                  zachowasz wszystkie utwory, playlisty i historię.
                </>
              ) : (
                <>
                  Potwierdzamy: Twoja subskrypcja została anulowana. Zachowasz pełen dostęp
                  do funkcji premium do <strong>{niceDate}</strong>. Po tej dacie konto
                  automatycznie przejdzie na plan Free — bez utraty żadnych Twoich danych.
                </>
              )}
            </Text>

            <Section style={infoBox}>
              <Text style={infoTitle}>📅 Data wygaśnięcia</Text>
              <Text style={infoValue}>{niceDate}</Text>
            </Section>

            <Text style={text}>
              Jeśli zmienisz zdanie, możesz wznowić subskrypcję w dowolnym momencie z portalu klienta.
            </Text>

            <Section style={buttonWrap}>
              <Button href={`${SITE_URL}/settings`} style={button}>
                Otwórz ustawienia konta
              </Button>
            </Section>

            <Hr style={hr} />

            <Text style={smallText}>
              Dziękujemy, że byłeś z nami. Twoje utwory, polubienia i historia czekają na Ciebie nawet po przejściu na Free.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              Pytania? Napisz na{' '}
              <Link href="mailto:kontakt@grouaistream.com" style={link}>
                kontakt@grouaistream.com
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SubscriptionCanceledEmail,
  subject: (data: Record<string, any>) =>
    data?.isReminder
      ? `⏰ Twój dostęp do ${SITE_NAME} kończy się jutro`
      : `Potwierdzamy anulowanie subskrypcji ${SITE_NAME}`,
  displayName: 'Subscription canceled',
  previewData: {
    displayName: 'Anna',
    periodEnd: new Date(Date.now() + 7 * 86400000).toISOString(),
    isReminder: false,
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
const infoTitle = { color: '#9a3412', fontSize: '12px', fontWeight: 'bold', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const infoValue = { color: '#0a0a0a', fontSize: '18px', fontWeight: 'bold', margin: '0' }
const buttonWrap = { textAlign: 'center' as const, margin: '24px 0' }
const button = { backgroundColor: '#ff6b1a', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const smallText = { color: '#6b7280', fontSize: '13px', lineHeight: '1.5', margin: '0' }
const footer = { padding: '20px 24px', backgroundColor: '#fafafa', textAlign: 'center' as const }
const footerText = { color: '#6b7280', fontSize: '12px', margin: '0' }
const link = { color: '#ff6b1a', textDecoration: 'underline' }
