/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Link, Img, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "GrouAI Stream"
const SITE_URL = "https://grouaistream.com"

interface NewBlogPostProps {
  recipientName?: string
  postTitle?: string
  postDescription?: string
  postSlug?: string
  postCoverUrl?: string | null
  emailHook?: string
  category?: string
  unsubscribeUrl?: string
}

const NewBlogPostEmail = ({
  recipientName,
  postTitle,
  postDescription,
  postSlug,
  postCoverUrl,
  emailHook,
  category,
  unsubscribeUrl,
}: NewBlogPostProps) => {
  const postUrl = SITE_URL
  const blogIndexUrl = `${SITE_URL}/blog`

  return (
    <Html lang="pl" dir="ltr">
      <Head />
      <Preview>{emailHook || postDescription || `Nowy artykuł na blogu ${SITE_NAME}`}</Preview>
      <Body style={main}>
        <Container style={outerWrap}>
          {/* HEADER */}
          <Section style={headerGradient}>
            <Text style={logoMark}>🎵</Text>
            <Text style={logo}>{SITE_NAME}</Text>
            <Text style={tagline}>· Świeży wpis na blogu ·</Text>
          </Section>

          {/* COVER */}
          {postCoverUrl ? (
            <Section style={coverWrap}>
              <Img src={postCoverUrl} alt={postTitle || ''} width="600" style={coverImg} />
              <div style={coverOverlay} />
            </Section>
          ) : (
            <Section style={coverFallback}>
              <Text style={coverFallbackEmoji}>📝</Text>
            </Section>
          )}

          {/* CONTENT */}
          <Section style={contentSection}>
            {category && (
              <Section style={{ marginBottom: '18px' }}>
                <Text style={badge}>· {category} ·</Text>
              </Section>
            )}

            <Heading style={h1}>{postTitle || 'Nowy artykuł'}</Heading>

            {recipientName && (
              <Text style={greeting}>Cześć, {recipientName} 👋</Text>
            )}

            {emailHook && (
              <Section style={hookBox}>
                <Text style={hookQuote}>„</Text>
                <Text style={hookText}>{emailHook}</Text>
              </Section>
            )}

            {postDescription && (
              <Text style={text}>{postDescription}</Text>
            )}

            {/* PRIMARY CTA */}
            <Section style={ctaSection}>
              <Button href={postUrl} style={ctaButton}>
                Czytaj cały artykuł →
              </Button>
              <Text style={ctaSubtext}>
                Pełny tekst czeka na Ciebie na blogu
              </Text>
            </Section>

            {/* SECONDARY CTA */}
            <Section style={secondaryCtaSection}>
              <Link href={blogIndexUrl} style={secondaryLink}>
                Zobacz wszystkie wpisy →
              </Link>
            </Section>
          </Section>

          <Hr style={hr} />

          {/* FOOTER */}
          <Section style={footerSection}>
            <Text style={footerBrand}>🎧 {SITE_NAME}</Text>
            <Text style={footerText}>
              Twój empatyczny DJ oparty na AI — rozpoznaje nastrój,<br />
              generuje muzykę i tworzy unikalne doświadczenia.
            </Text>
            <Section style={footerLinks}>
              <Link href={SITE_URL} style={footerLink}>Strona</Link>
              <Text style={footerDot}>·</Text>
              <Link href={blogIndexUrl} style={footerLink}>Blog</Link>
              <Text style={footerDot}>·</Text>
              <Link href={`${SITE_URL}/radio`} style={footerLink}>Radio</Link>
            </Section>
            {unsubscribeUrl && (
              <Text style={unsub}>
                Nie chcesz otrzymywać newslettera?{' '}
                <Link href={unsubscribeUrl} style={unsubLink}>Wypisz się</Link>
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: NewBlogPostEmail,
  subject: (data: Record<string, any>) =>
    data?.subject || `📝 Nowy wpis: ${data?.postTitle || 'GrouAI Stream Blog'}`,
  displayName: 'Nowy wpis na blogu',
  previewData: {
    recipientName: 'Olek',
    postTitle: 'Jak AI zmienia sposób, w jaki słuchamy muzyki w 2026',
    postDescription: 'Krótki opis wpisu — co czytelnik dostanie i dlaczego warto kliknąć.',
    postSlug: 'jak-ai-zmienia-muzyke-2026',
    postCoverUrl: 'https://grouaistream.com/og-image.jpg',
    emailHook: 'Trzy sekundy. Tyle wystarczy AI by ułożyć soundtrack Twojego dnia.',
    category: 'trends',
    unsubscribeUrl: 'https://grouaistream.com/unsubscribe?token=demo',
  },
} satisfies TemplateEntry

/* === STYLES === */
const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
  margin: '0',
  padding: '24px 12px',
}
const outerWrap = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '20px',
  overflow: 'hidden' as const,
  boxShadow: '0 20px 60px rgba(232,69,10,0.18), 0 4px 20px rgba(0,0,0,0.08)',
  border: '1px solid #ececec',
}
const headerGradient = {
  background: 'linear-gradient(135deg, #e8450a 0%, #f59e0b 50%, #e8450a 100%)',
  padding: '36px 24px 28px',
  textAlign: 'center' as const,
}
const logoMark = { fontSize: '34px', margin: '0 0 4px', lineHeight: '1' }
const logo = {
  fontSize: '26px',
  fontWeight: '800' as const,
  color: '#ffffff',
  margin: '0',
  letterSpacing: '-0.5px',
  textShadow: '0 2px 8px rgba(0,0,0,0.2)',
}
const tagline = {
  fontSize: '12px',
  color: 'rgba(255,255,255,0.95)',
  margin: '8px 0 0',
  letterSpacing: '1.2px',
  textTransform: 'uppercase' as const,
  fontWeight: '600' as const,
}
const coverWrap = { padding: 0, position: 'relative' as const, lineHeight: 0 }
const coverImg = { width: '100%', height: 'auto', display: 'block' as const, objectFit: 'cover' as const, maxHeight: '320px' }
const coverOverlay = {
  position: 'absolute' as const,
  bottom: 0, left: 0, right: 0, height: '60px',
  background: 'linear-gradient(to bottom, transparent, #0a0a0a)',
}
const coverFallback = {
  background: 'linear-gradient(135deg, #1a1a1a 0%, #2a1410 100%)',
  padding: '48px 24px',
  textAlign: 'center' as const,
}
const coverFallbackEmoji = { fontSize: '56px', margin: '0', lineHeight: '1' }
const contentSection = { padding: '32px 32px 28px', backgroundColor: '#0a0a0a' }
const badge = {
  display: 'inline-block' as const,
  fontSize: '11px',
  fontWeight: '700' as const,
  color: '#e8450a',
  backgroundColor: 'rgba(232,69,10,0.15)',
  padding: '6px 16px',
  borderRadius: '999px',
  textTransform: 'uppercase' as const,
  letterSpacing: '1.2px',
  margin: '0',
  border: '1px solid rgba(232,69,10,0.3)',
}
const h1 = {
  fontSize: '28px',
  fontWeight: '800' as const,
  color: '#fafafa',
  margin: '0 0 18px',
  lineHeight: '1.25',
  letterSpacing: '-0.5px',
}
const greeting = { fontSize: '15px', color: '#a1a1aa', margin: '0 0 22px', fontWeight: '500' as const }
const hookBox = {
  background: 'linear-gradient(135deg, rgba(232,69,10,0.12), rgba(245,158,11,0.06))',
  borderRadius: '14px',
  padding: '22px 24px 20px',
  borderLeft: '4px solid #e8450a',
  margin: '0 0 26px',
  position: 'relative' as const,
}
const hookQuote = {
  fontSize: '48px',
  color: '#e8450a',
  margin: '0',
  lineHeight: '0.6',
  fontFamily: 'Georgia, serif',
  opacity: 0.5,
}
const hookText = {
  fontSize: '17px',
  color: '#fafafa',
  lineHeight: '1.6',
  margin: '8px 0 0',
  fontStyle: 'italic' as const,
  fontWeight: '500' as const,
}
const text = { fontSize: '15px', color: '#d4d4d8', lineHeight: '1.75', margin: '0 0 32px' }
const ctaSection = { textAlign: 'center' as const, margin: '0 0 24px' }
const ctaButton = {
  background: 'linear-gradient(135deg, #e8450a 0%, #f59e0b 100%)',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '700' as const,
  padding: '16px 40px',
  borderRadius: '12px',
  textDecoration: 'none',
  display: 'inline-block' as const,
  boxShadow: '0 8px 24px rgba(232,69,10,0.4)',
  letterSpacing: '0.3px',
}
const ctaSubtext = { fontSize: '12px', color: '#71717a', margin: '14px 0 0', fontStyle: 'italic' as const }
const secondaryCtaSection = { textAlign: 'center' as const, margin: '8px 0 0' }
const secondaryLink = {
  fontSize: '13px',
  color: '#a1a1aa',
  textDecoration: 'none',
  borderBottom: '1px dashed rgba(232,69,10,0.4)',
  paddingBottom: '2px',
}
const hr = { borderColor: '#1f1f1f', margin: '0' }
const footerSection = { padding: '28px 28px 32px', textAlign: 'center' as const, backgroundColor: '#050505' }
const footerBrand = { fontSize: '14px', fontWeight: '700' as const, color: '#e8450a', margin: '0 0 10px', letterSpacing: '0.3px' }
const footerText = { fontSize: '12px', color: '#71717a', lineHeight: '1.7', margin: '0 0 18px' }
const footerLinks = { margin: '0 0 18px', textAlign: 'center' as const }
const footerLink = {
  fontSize: '12px',
  color: '#a1a1aa',
  textDecoration: 'none',
  fontWeight: '600' as const,
  margin: '0 4px',
  display: 'inline-block' as const,
}
const footerDot = { fontSize: '12px', color: '#52525b', margin: '0 4px', display: 'inline-block' as const }
const unsub = { fontSize: '11px', color: '#52525b', margin: '0' }
const unsubLink = { color: '#e8450a', textDecoration: 'underline' }
