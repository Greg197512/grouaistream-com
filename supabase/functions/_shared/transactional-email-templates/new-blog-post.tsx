/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Link, Img,
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
  const postUrl = `${SITE_URL}/blog/${postSlug}`
  return (
    <Html lang="pl" dir="ltr">
      <Head />
      <Preview>{emailHook || postDescription || `Nowy artykuł na blogu ${SITE_NAME}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerGradient}>
            <Text style={logo}>🎵 {SITE_NAME}</Text>
            <Text style={tagline}>Świeży wpis na blogu</Text>
          </Section>

          {postCoverUrl && (
            <Section style={{ padding: 0 }}>
              <Img src={postCoverUrl} alt={postTitle || ''} width="580" style={coverImg} />
            </Section>
          )}

          <Section style={contentSection}>
            {category && <Text style={badge}>{category}</Text>}

            <Heading style={h1}>{postTitle || 'Nowy artykuł'}</Heading>

            {recipientName && (
              <Text style={greeting}>Cześć, {recipientName}! 👋</Text>
            )}

            {emailHook && (
              <Section style={hookBox}>
                <Text style={hookText}>{emailHook}</Text>
              </Section>
            )}

            {postDescription && (
              <Text style={text}>{postDescription}</Text>
            )}

            <Section style={ctaSection}>
              <Link href={postUrl} style={ctaButton}>
                Czytaj cały artykuł →
              </Link>
            </Section>
          </Section>

          <Hr style={hr} />

          <Section style={footerSection}>
            <Text style={footerBrand}>🎧 {SITE_NAME}</Text>
            <Text style={footerText}>
              Twój empatyczny DJ oparty na AI — rozpoznaje nastrój,<br />
              generuje muzykę i tworzy unikalne doświadczenia.
            </Text>
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
    postDescription: 'Krótki opis wpisu — co czytelnik dostanie.',
    postSlug: 'jak-ai-zmienia-muzyke-2026',
    postCoverUrl: null,
    emailHook: 'Trzy sekundy. Tyle wystarczy AI by ułożyć soundtrack Twojego dnia.',
    category: 'trends',
    unsubscribeUrl: 'https://grouaistream.com/unsubscribe?token=demo',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#0a0a0a', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" }
const container = { maxWidth: '580px', margin: '0 auto', backgroundColor: '#111111', borderRadius: '16px', overflow: 'hidden' as const, boxShadow: '0 4px 32px rgba(232,69,10,0.15)' }
const headerGradient = { background: 'linear-gradient(135deg, #e8450a 0%, #f59e0b 50%, #e8450a 100%)', padding: '28px 24px', textAlign: 'center' as const }
const logo = { fontSize: '24px', fontWeight: '700' as const, color: '#ffffff', margin: '0', letterSpacing: '-0.5px' }
const tagline = { fontSize: '13px', color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', letterSpacing: '0.5px' }
const coverImg = { width: '100%', height: 'auto', display: 'block' as const }
const contentSection = { padding: '32px 28px 24px' }
const badge = { fontSize: '11px', fontWeight: '600' as const, color: '#e8450a', backgroundColor: 'rgba(232,69,10,0.12)', padding: '5px 14px', borderRadius: '20px', display: 'inline-block' as const, textTransform: 'uppercase' as const, letterSpacing: '0.8px', margin: '0 0 16px' }
const h1 = { fontSize: '26px', fontWeight: '700' as const, color: '#fafafa', margin: '0 0 16px', lineHeight: '1.3' }
const greeting = { fontSize: '15px', color: '#a1a1aa', margin: '0 0 20px' }
const hookBox = { background: 'linear-gradient(135deg, rgba(232,69,10,0.1), rgba(245,158,11,0.05))', borderRadius: '12px', padding: '20px 22px', borderLeft: '4px solid #e8450a', margin: '0 0 24px' }
const hookText = { fontSize: '17px', color: '#fafafa', lineHeight: '1.6', margin: '0', fontStyle: 'italic' as const }
const text = { fontSize: '15px', color: '#d4d4d8', lineHeight: '1.7', margin: '0 0 28px' }
const ctaSection = { textAlign: 'center' as const }
const ctaButton = { background: 'linear-gradient(135deg, #e8450a 0%, #f59e0b 100%)', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, padding: '14px 36px', borderRadius: '10px', textDecoration: 'none', display: 'inline-block' as const }
const hr = { borderColor: '#27272a', margin: '0' }
const footerSection = { padding: '24px 28px 28px', textAlign: 'center' as const }
const footerBrand = { fontSize: '14px', fontWeight: '600' as const, color: '#a1a1aa', margin: '0 0 8px' }
const footerText = { fontSize: '12px', color: '#71717a', lineHeight: '1.6', margin: '0 0 16px' }
const unsub = { fontSize: '11px', color: '#71717a', margin: '0' }
const unsubLink = { color: '#e8450a', textDecoration: 'underline' }
