/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Link, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "GrouAI Stream"

type Lang = 'pl' | 'en' | 'nl' | 'uk'

interface AdminNotificationProps {
  title?: string
  message?: string
  recipientName?: string
  emailType?: string
  heroImageUrl?: string
  language?: Lang
  cta?: string
  ctaUrl?: string
  headline?: string
  fullHtml?: string
}

const I18N: Record<Lang, { tagline: string; greeting: (n: string) => string; defaultCta: string; defaultMessage: string; defaultTitle: string; signature: string; tagPill: string; }> = {
  pl: { tagline: 'Muzyka, która słucha Ciebie', greeting: (n) => `Cześć, ${n}!`, defaultCta: 'Otwórz GrouAI Stream', defaultMessage: 'Masz nową wiadomość z GrouAI Stream.', defaultTitle: 'Wiadomość', signature: 'Z muzycznym pozdrowieniem,\nZespół GrouAI Stream', tagPill: 'AI · LIVE · STUDIO' },
  en: { tagline: 'Music that listens to you', greeting: (n) => `Hi ${n},`, defaultCta: 'Open GrouAI Stream', defaultMessage: 'You have a new message from GrouAI Stream.', defaultTitle: 'Notification', signature: 'With a musical hello,\nThe GrouAI Stream team', tagPill: 'AI · LIVE · STUDIO' },
  nl: { tagline: 'Muziek die naar jou luistert', greeting: (n) => `Beste ${n},`, defaultCta: 'Open GrouAI Stream', defaultMessage: 'U hebt een nieuw bericht van GrouAI Stream.', defaultTitle: 'Bericht', signature: 'Met muzikale groet,\nHet team van GrouAI Stream', tagPill: 'AI · LIVE · STUDIO' },
  uk: { tagline: 'Музика, що слухає тебе', greeting: (n) => `Привіт, ${n}!`, defaultCta: 'Відкрити GrouAI Stream', defaultMessage: 'У тебе нове повідомлення від GrouAI Stream.', defaultTitle: 'Повідомлення', signature: 'З музичним вітанням,\nКоманда GrouAI Stream', tagPill: 'AI · LIVE · STUDIO' },
}

const AdminNotificationEmail = (props: AdminNotificationProps) => {
  // Bypass — gdy mass-email-dispatch przekazuje gotowy bogato-zaprojektowany HTML
  if (props.fullHtml) {
    return (
      <Html lang={props.language || 'pl'} dir="ltr">
        <Head />
        <Preview>{props.title || props.headline || SITE_NAME}</Preview>
        <Body style={{ margin: 0, padding: 0 }}>
          <div dangerouslySetInnerHTML={{ __html: props.fullHtml }} />
        </Body>
      </Html>
    )
  }

  const lang: Lang = (['pl', 'en', 'nl', 'uk'].includes(props.language || '') ? props.language : 'pl') as Lang
  const t = I18N[lang]
  const headline = props.headline || props.title || t.defaultTitle
  const ctaText = props.cta || t.defaultCta
  const ctaUrl = props.ctaUrl || 'https://grouaistream.com'
  const message = props.message || t.defaultMessage

  return (
    <Html lang={lang} dir="ltr">
      <Head />
      <Preview>{headline}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandStrip}>
            <Text style={brandText}>
              Grou<span style={{ color: '#e8450a' }}>AI</span> Stream
            </Text>
            <Text style={brandTagline}>{t.tagline}</Text>
          </Section>

          {props.heroImageUrl ? (
            <Img src={props.heroImageUrl} alt="" width="600" style={heroImg} />
          ) : (
            <Section style={heroFallback}>
              <Text style={heroFallbackText}>♪</Text>
            </Section>
          )}

          <Section style={contentSection}>
            {props.emailType && (
              <Text style={badge}>{props.emailType}</Text>
            )}

            <Heading style={h1}>{headline}</Heading>

            {props.recipientName && (
              <Text style={greeting}>{t.greeting(props.recipientName)}</Text>
            )}

            <Section style={messageBox}>
              {(message || '').split('\n').filter((p) => p.trim()).map((p, i) => (
                <Text key={i} style={text}>{p}</Text>
              ))}
            </Section>

            <Section style={ctaSection}>
              <Link href={ctaUrl} style={ctaButton}>{ctaText}</Link>
            </Section>
          </Section>

          <Hr style={hr} />

          <Section style={footerSection}>
            <Text style={footerBrand}>{SITE_NAME}</Text>
            <Text style={footerSignature}>
              {t.signature.split('\n').map((l, i) => (
                <React.Fragment key={i}>{l}<br /></React.Fragment>
              ))}
            </Text>
            <Text style={footerTag}>{t.tagPill}</Text>
            <Text style={footerLink}>
              <Link href="https://grouaistream.com" style={{ color: '#e8450a', textDecoration: 'none' }}>grouaistream.com</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AdminNotificationEmail,
  subject: (data: Record<string, any>) => data?.title || data?.headline || `${SITE_NAME}`,
  displayName: 'Admin / Mass email (multi-lang)',
  previewData: {
    title: 'Nowa funkcja: AI Studio 2.0',
    headline: 'Stwórz utwór, którego nikt nie napisał',
    message: 'Powiedz tylko, jaki masz nastrój, a AI zbuduje 30-sekundowy kawałek od zera.\nWybierz spośród 15 gatunków i dodaj swoje słowa.',
    recipientName: 'Anna',
    emailType: 'Nowość',
    language: 'pl',
    cta: 'Otwórz AI Studio',
    ctaUrl: 'https://grouaistream.com',
  },
} satisfies TemplateEntry

/* ── Styles ── */
const main = {
  backgroundColor: '#0a0a0a',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
  margin: 0,
  padding: '24px 12px',
}
const container = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  overflow: 'hidden' as const,
  boxShadow: '0 24px 60px rgba(232, 69, 10, 0.18)',
}
const brandStrip = {
  background: '#0a0a0a',
  padding: '18px 32px 14px',
  textAlign: 'left' as const,
}
const brandText = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '700' as const,
  letterSpacing: '0.5px',
  margin: 0,
  fontFamily: "'Space Grotesk', sans-serif",
}
const brandTagline = {
  color: '#888',
  fontSize: '11px',
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  margin: '4px 0 0',
}
const heroImg = {
  display: 'block',
  width: '100%',
  maxWidth: '600px',
  height: 'auto',
}
const heroFallback = {
  background: 'linear-gradient(135deg, #e8450a 0%, #f59e0b 50%, #e8450a 100%)',
  padding: '60px 24px',
  textAlign: 'center' as const,
}
const heroFallbackText = {
  fontSize: '48px',
  color: '#ffffff',
  margin: 0,
  lineHeight: '1',
}
const contentSection = { padding: '36px 32px 24px' }
const badge = {
  fontSize: '11px',
  fontWeight: '600' as const,
  color: '#e8450a',
  backgroundColor: '#fef3ec',
  padding: '5px 14px',
  borderRadius: '999px',
  display: 'inline-block' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.8px',
  margin: '0 0 16px',
}
const h1 = {
  fontSize: '30px',
  fontWeight: '700' as const,
  color: '#0a0a0a',
  margin: '0 0 16px',
  lineHeight: '1.2',
  letterSpacing: '-0.4px',
  fontFamily: "'Space Grotesk', 'Inter', sans-serif",
}
const greeting = { fontSize: '15px', color: '#3f3f46', margin: '0 0 18px', lineHeight: '1.5' }
const messageBox = { margin: '0 0 28px' }
const text = { fontSize: '15px', color: '#2d2d2d', lineHeight: '1.75', margin: '0 0 14px' }
const ctaSection = { margin: '8px 0 0' }
const ctaButton = {
  background: 'linear-gradient(135deg, #e8450a 0%, #f59e0b 100%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  padding: '14px 36px',
  borderRadius: '999px',
  textDecoration: 'none',
  display: 'inline-block' as const,
  letterSpacing: '0.4px',
  boxShadow: '0 8px 24px rgba(232, 69, 10, 0.35)',
}
const hr = { borderColor: '#e4e4e7', margin: '0' }
const footerSection = { padding: '24px 32px 28px', backgroundColor: '#0a0a0a', textAlign: 'center' as const }
const footerBrand = { fontSize: '13px', fontWeight: '600' as const, color: '#fff', margin: '0 0 6px' }
const footerSignature = { fontSize: '12px', color: '#888', lineHeight: '1.6', margin: '0 0 12px', fontStyle: 'italic' as const }
const footerTag = {
  display: 'inline-block' as const,
  fontSize: '10px',
  letterSpacing: '1.5px',
  color: '#e8450a',
  border: '1px solid rgba(232, 69, 10, 0.3)',
  borderRadius: '999px',
  padding: '4px 12px',
  margin: '0 0 10px',
}
const footerLink = { fontSize: '11px', margin: 0 }
