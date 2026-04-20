/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Link, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'GrouAI Stream'
const SITE_URL = 'https://grouaistream.com'

interface ReceivedProps {
  displayName?: string
  amount?: number       // total purchase amount in EUR
  emoji?: string
  trackTitle?: string
  fromName?: string
}

const CoffeeTipReceivedEmail = ({ displayName, amount, emoji = '☕', trackTitle, fromName }: ReceivedProps) => {
  const yourShare = amount ? (amount * 0.9).toFixed(2) : '—'
  return (
    <Html lang="pl" dir="ltr">
      <Head />
      <Preview>Ktoś postawił Ci kawę {emoji} — masz nowy zarobek</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Text style={logoIcon}>{emoji}</Text>
            <Heading style={h1}>{SITE_NAME}</Heading>
          </Section>

          <Section style={content}>
            <Heading style={h2}>Dostałeś kawę {emoji}</Heading>

            <Text style={text}>Cześć {displayName || 'tam'},</Text>

            <Text style={text}>
              {fromName ? <><strong>{fromName}</strong> postawił</> : <>Ktoś właśnie postawił</>} Ci kawę
              {trackTitle ? <> za utwór <strong>„{trackTitle}"</strong></> : null}.
              90% wpłaty właśnie zostało dopisane do Twoich zarobków na GrouAI Stream.
            </Text>

            <Section style={infoBox}>
              <Text style={infoTitle}>💰 Twój nowy zarobek</Text>
              <Text style={infoValue}>+{yourShare}€</Text>
              <Text style={infoSub}>z całkowitej wpłaty {amount?.toFixed(2) || '—'}€</Text>
            </Section>

            <Text style={text}>
              Każda kawa to dowód, że ktoś naprawdę słucha. Pisz dalej. Twórz dalej.
            </Text>

            <Section style={buttonWrap}>
              <Button href={`${SITE_URL}/creator-earnings`} style={button}>
                Zobacz swoje zarobki
              </Button>
            </Section>

            <Hr style={hr} />

            <Text style={smallText}>
              Wypłatę możesz zlecić w panelu „Earnings", gdy uzbierasz minimum progu wypłat.
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
}

export const template = {
  component: CoffeeTipReceivedEmail,
  subject: (data: Record<string, any>) =>
    `${data?.emoji || '☕'} Dostałeś kawę — +${data?.amount ? (data.amount * 0.9).toFixed(2) : '?'}€ na koncie`,
  displayName: 'Coffee tip — received',
  previewData: { displayName: 'Marek', amount: 3, emoji: '☕🥛', trackTitle: 'Neon Aurora', fromName: 'Anna' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: 0, padding: 0 }
const container = { maxWidth: '560px', margin: '0 auto', padding: '0' }
const headerSection = { backgroundColor: '#0a0a0a', padding: '28px 24px', textAlign: 'center' as const }
const logoIcon = { fontSize: '32px', margin: '0' }
const h1 = { color: '#ff6b1a', fontSize: '24px', fontWeight: 'bold', margin: '8px 0 0', letterSpacing: '-0.5px' }
const content = { padding: '32px 24px' }
const h2 = { color: '#0a0a0a', fontSize: '22px', fontWeight: 'bold', margin: '0 0 16px' }
const text = { color: '#3a3a3a', fontSize: '15px', lineHeight: '1.6', margin: '0 0 16px' }
const infoBox = { backgroundColor: '#ecfdf5', borderLeft: '4px solid #10b981', padding: '16px 18px', borderRadius: '6px', margin: '20px 0' }
const infoTitle = { color: '#065f46', fontSize: '12px', fontWeight: 'bold', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const infoValue = { color: '#065f46', fontSize: '28px', fontWeight: 'bold', margin: '0 0 6px' }
const infoSub = { color: '#6b7280', fontSize: '12px', margin: '0' }
const buttonWrap = { textAlign: 'center' as const, margin: '24px 0' }
const button = { backgroundColor: '#10b981', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const smallText = { color: '#6b7280', fontSize: '13px', lineHeight: '1.5', margin: '0' }
const footer = { padding: '20px 24px', backgroundColor: '#fafafa', textAlign: 'center' as const }
const footerText = { color: '#6b7280', fontSize: '12px', margin: '0' }
const link = { color: '#ff6b1a', textDecoration: 'underline' }
