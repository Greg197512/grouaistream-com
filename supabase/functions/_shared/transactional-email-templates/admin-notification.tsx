/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "GrouAI Stream"

interface AdminNotificationProps {
  title?: string
  message?: string
  recipientName?: string
  emailType?: string
}

const AdminNotificationEmail = ({ title, message, recipientName, emailType }: AdminNotificationProps) => (
  <Html lang="pl" dir="ltr">
    <Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
      `}</style>
    </Head>
    <Preview>{title || `Powiadomienie z ${SITE_NAME}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header with brand gradient */}
        <Section style={headerSection}>
          <Section style={headerGradient}>
            <Text style={logoIcon}>🎵</Text>
            <Text style={logo}>{SITE_NAME}</Text>
            <Text style={tagline}>Muzyka, która słucha Ciebie</Text>
          </Section>
        </Section>

        {/* Content area */}
        <Section style={contentSection}>
          {emailType && (
            <Section style={badgeWrapper}>
              <Text style={badge}>{emailType}</Text>
            </Section>
          )}

          <Heading style={h1}>
            {title || 'Powiadomienie'}
          </Heading>

          {recipientName && (
            <Text style={greeting}>Cześć, {recipientName}! 👋</Text>
          )}

          <Section style={messageBox}>
            <Text style={text}>
              {message || 'Masz nowe powiadomienie z GrouAI Stream.'}
            </Text>
          </Section>

          {/* CTA Button */}
          <Section style={ctaSection}>
            <Link href="https://grouaistream-com.lovable.app" style={ctaButton}>
              Otwórz GrouAI Stream
            </Link>
          </Section>
        </Section>

        {/* Divider */}
        <Hr style={hr} />

        {/* Footer */}
        <Section style={footerSection}>
          <Text style={footerBrand}>🎧 {SITE_NAME}</Text>
          <Text style={footerText}>
            Twój empatyczny DJ oparty na AI — rozpoznaje nastrój,<br />
            generuje muzykę i tworzy unikalne doświadczenia.
          </Text>
          <Text style={footerSignature}>
            Z muzycznym pozdrowieniem,<br />
            Zespół {SITE_NAME} 🎶
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdminNotificationEmail,
  subject: (data: Record<string, any>) => data?.title || `Powiadomienie z ${SITE_NAME}`,
  displayName: 'Powiadomienie admin',
  previewData: { title: 'Nowy e-mail z GrouAI Stream', message: 'To jest testowe powiadomienie z profesjonalną szatą graficzną.', recipientName: 'Admin', emailType: 'Powiadomienie systemowe' },
} satisfies TemplateEntry

/* ── Styles ── */
const main = {
  backgroundColor: '#f4f4f5',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
}

const container = {
  maxWidth: '580px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  overflow: 'hidden' as const,
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
}

const headerSection = {
  padding: '0',
}

const headerGradient = {
  background: 'linear-gradient(135deg, #e8450a 0%, #f59e0b 50%, #e8450a 100%)',
  padding: '32px 24px 28px',
  textAlign: 'center' as const,
}

const logoIcon = {
  fontSize: '32px',
  margin: '0 0 4px',
  lineHeight: '1',
}

const logo = {
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#ffffff',
  margin: '0',
  letterSpacing: '-0.5px',
}

const tagline = {
  fontSize: '13px',
  color: 'rgba(255, 255, 255, 0.85)',
  margin: '6px 0 0',
  fontWeight: '400' as const,
  letterSpacing: '0.5px',
}

const contentSection = {
  padding: '32px 28px 24px',
}

const badgeWrapper = {
  marginBottom: '16px',
}

const badge = {
  fontSize: '11px',
  fontWeight: '600' as const,
  color: '#e8450a',
  backgroundColor: '#fef3ec',
  padding: '5px 14px',
  borderRadius: '20px',
  display: 'inline-block' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.8px',
  margin: '0',
}

const h1 = {
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#18181b',
  margin: '0 0 16px',
  lineHeight: '1.3',
  letterSpacing: '-0.3px',
}

const greeting = {
  fontSize: '16px',
  color: '#3f3f46',
  margin: '0 0 20px',
  lineHeight: '1.5',
}

const messageBox = {
  backgroundColor: '#fafafa',
  borderRadius: '12px',
  padding: '20px 22px',
  borderLeft: '4px solid #e8450a',
  margin: '0 0 28px',
}

const text = {
  fontSize: '15px',
  color: '#3f3f46',
  lineHeight: '1.7',
  margin: '0',
}

const ctaSection = {
  textAlign: 'center' as const,
  margin: '0 0 8px',
}

const ctaButton = {
  background: 'linear-gradient(135deg, #e8450a 0%, #f59e0b 100%)',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600' as const,
  padding: '14px 32px',
  borderRadius: '10px',
  textDecoration: 'none',
  display: 'inline-block' as const,
  letterSpacing: '0.3px',
}

const hr = {
  borderColor: '#e4e4e7',
  margin: '0',
}

const footerSection = {
  padding: '24px 28px 28px',
  textAlign: 'center' as const,
}

const footerBrand = {
  fontSize: '14px',
  fontWeight: '600' as const,
  color: '#71717a',
  margin: '0 0 8px',
}

const footerText = {
  fontSize: '12px',
  color: '#a1a1aa',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const footerSignature = {
  fontSize: '12px',
  color: '#a1a1aa',
  margin: '0',
  lineHeight: '1.5',
  fontStyle: 'italic' as const,
}
