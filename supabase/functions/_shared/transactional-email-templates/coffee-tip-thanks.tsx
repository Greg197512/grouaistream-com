/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Link, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'GrouAI Stream'
const SITE_URL = 'https://grouaistream.com'

interface ThanksProps {
  displayName?: string
  amount?: number
  emoji?: string
  recipientName?: string
}

const CoffeeTipThanksEmail = ({ displayName, amount, emoji = '☕', recipientName }: ThanksProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Dziękujemy za kawę {emoji} — 90% trafia do twórcy</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={logoIcon}>{emoji}</Text>
          <Heading style={h1}>{SITE_NAME}</Heading>
        </Section>

        <Section style={content}>
          <Heading style={h2}>Dziękujemy za kawę!</Heading>

          <Text style={text}>Cześć {displayName || 'tam'},</Text>

          <Text style={text}>
            Twoja kawa za <strong>{amount?.toFixed(2) || '—'}€</strong> właśnie dotarła.
            {recipientName
              ? <> 90% z tej kwoty wędruje prosto do <strong>{recipientName}</strong>, twórcy, którego utwór dziś gra.</>
              : <> 90% z tej kwoty wędruje prosto do losowego twórcy, którego utwór dziś gra na platformie.</>}
          </Text>

          <Section style={infoBox}>
            <Text style={infoTitle}>{emoji} Twoja kawa</Text>
            <Text style={infoValue}>{amount?.toFixed(2) || '—'}€</Text>
            <Text style={infoSub}>90% → twórca · 10% → utrzymanie serwerów</Text>
          </Section>

          <Text style={text}>
            Bez Ciebie ta muzyka nie miałaby z czego żyć. Naprawdę.
          </Text>

          <Section style={buttonWrap}>
            <Button href={SITE_URL} style={button}>Wracaj słuchać</Button>
          </Section>

          <Hr style={hr} />

          <Text style={smallText}>
            To jednorazowa płatność — nie tworzymy z niej subskrypcji. Faktura przychodzi
            osobno od Paddle (Merchant of Record).
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
  component: CoffeeTipThanksEmail,
  subject: (data: Record<string, any>) =>
    `Dziękujemy za kawę ${data?.emoji || '☕'} — wsparłeś GrouAI Stream`,
  displayName: 'Coffee tip — thanks',
  previewData: { displayName: 'Anna', amount: 3, emoji: '☕🥛', recipientName: 'Marek' },
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
const infoValue = { color: '#0a0a0a', fontSize: '24px', fontWeight: 'bold', margin: '0 0 6px' }
const infoSub = { color: '#6b7280', fontSize: '12px', margin: '0' }
const buttonWrap = { textAlign: 'center' as const, margin: '24px 0' }
const button = { backgroundColor: '#ff6b1a', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const smallText = { color: '#6b7280', fontSize: '13px', lineHeight: '1.5', margin: '0' }
const footer = { padding: '20px 24px', backgroundColor: '#fafafa', textAlign: 'center' as const }
const footerText = { color: '#6b7280', fontSize: '12px', margin: '0' }
const link = { color: '#ff6b1a', textDecoration: 'underline' }
