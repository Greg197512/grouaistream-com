/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
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
    <Head />
    <Preview>{title || `Powiadomienie z ${SITE_NAME}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={logo}>🎵 {SITE_NAME}</Text>
        </Section>
        <Heading style={h1}>
          {title || 'Powiadomienie'}
        </Heading>
        {recipientName && (
          <Text style={greeting}>Cześć, {recipientName}! 👋</Text>
        )}
        {emailType && (
          <Text style={badge}>{emailType}</Text>
        )}
        <Text style={text}>
          {message || 'Masz nowe powiadomienie z GrouAI Stream.'}
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Z muzycznym pozdrowieniem,<br />
          Zespół {SITE_NAME} 🎶
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdminNotificationEmail,
  subject: (data: Record<string, any>) => data?.title || `Powiadomienie z ${SITE_NAME}`,
  displayName: 'Powiadomienie admin',
  previewData: { title: 'Nowy e-mail z GrouAI Stream', message: 'To jest testowe powiadomienie.', recipientName: 'Admin' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px', maxWidth: '580px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, padding: '20px 0 10px' }
const logo = { fontSize: '20px', fontWeight: 'bold' as const, color: '#e8450a', margin: '0' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000000', margin: '10px 0 20px' }
const greeting = { fontSize: '16px', color: '#333333', margin: '0 0 15px' }
const badge = { fontSize: '12px', color: '#e8450a', backgroundColor: '#fff3ec', padding: '4px 12px', borderRadius: '12px', display: 'inline-block' as const, margin: '0 0 15px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 25px' }
const hr = { borderColor: '#eeeeee', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0', lineHeight: '1.5' }
