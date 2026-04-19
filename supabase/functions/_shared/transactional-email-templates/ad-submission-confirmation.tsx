/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  company_name?: string
  contact_email?: string
  ad_title?: string
  ad_description?: string
  ad_url?: string
  ad_image_url?: string
  industry?: string
  amount_eur?: number
  payment_deadline?: string
  post_url?: string
}

const formatDeadline = (value?: string) => {
  if (!value) return 'w ciągu 24 godzin'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'w ciągu 24 godzin'
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date)
}

const AdSubmissionConfirmationEmail = ({
  company_name,
  contact_email,
  ad_title,
  ad_description,
  ad_url,
  ad_image_url,
  industry,
  amount_eur = 5,
  payment_deadline,
  post_url,
}: Props) => {
  const deadlineText = formatDeadline(payment_deadline)

  return (
    <Html lang="pl" dir="ltr">
      <Head />
      <Preview>Twoja reklama została przyjęta — pełne podsumowanie i płatność {amount_eur} €</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={heroSection}>
            <Text style={eyebrow}>GrouAI Stream · reklama partnera</Text>
            <Heading style={h1}>Twoje zgłoszenie zostało przyjęte</Heading>
            <Text style={lead}>
              Poniżej masz od razu cały komplet: treść reklamy, link publikacji i dane o płatności.
            </Text>
          </Section>

          <Section style={priceCard}>
            <Text style={priceLabel}>Kwota do opłaty</Text>
            <Text style={priceValue}>{amount_eur} €</Text>
            <Text style={priceNote}>30 dni publikacji · płatność do {deadlineText}</Text>
          </Section>

          <Section style={contentSection}>
            <Heading as="h2" style={sectionTitle}>Pełne podsumowanie zgłoszenia</Heading>

            <Section style={detailBox}>
              <Text style={detailLabel}>Firma</Text>
              <Text style={detailValue}>{company_name || '—'}</Text>
            </Section>

            <Section style={detailBox}>
              <Text style={detailLabel}>Email kontaktowy</Text>
              <Text style={detailValue}>{contact_email || '—'}</Text>
            </Section>

            <Section style={detailBox}>
              <Text style={detailLabel}>Tytuł reklamy</Text>
              <Text style={detailValue}>{ad_title || '—'}</Text>
            </Section>

            {industry ? (
              <Section style={detailBox}>
                <Text style={detailLabel}>Branża</Text>
                <Text style={detailValue}>{industry}</Text>
              </Section>
            ) : null}

            {ad_url ? (
              <Section style={detailBox}>
                <Text style={detailLabel}>Link docelowy</Text>
                <Link href={ad_url} style={linkValue}>{ad_url}</Link>
              </Section>
            ) : null}

            <Section style={detailBoxLarge}>
              <Text style={detailLabel}>Opis reklamy</Text>
              <Text style={detailText}>{ad_description || '—'}</Text>
            </Section>

            {ad_image_url ? (
              <Section style={imageWrapper}>
                <Text style={detailLabel}>Podgląd grafiki</Text>
                <Img src={ad_image_url} alt={ad_title || 'Grafika reklamy'} style={image} />
              </Section>
            ) : null}

            <Hr style={divider} />

            <Heading as="h2" style={sectionTitle}>Co dalej</Heading>
            <Text style={paragraph}>Reklama jest już przygotowana do emisji. Po zaksięgowaniu płatności pozostaje aktywna przez 30 dni.</Text>
            {post_url ? (
              <Section style={ctaSection}>
                <Link href={post_url} style={ctaButton}>Zobacz swoją reklamę na blogu</Link>
              </Section>
            ) : null}
            {post_url ? <Link href={post_url} style={fallbackLink}>{post_url}</Link> : null}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AdSubmissionConfirmationEmail,
  subject: (data: Record<string, any>) => `Potwierdzenie reklamy${data?.company_name ? ` — ${data.company_name}` : ''} · 5 €`,
  displayName: 'Potwierdzenie zgłoszenia reklamy',
  previewData: {
    company_name: 'Test Demo Café',
    contact_email: 'grouarock@gmail.com',
    ad_title: 'Najlepsza kawa i muzyka na żywo w centrum miasta',
    ad_description: 'Zapraszamy na koncerty, brunche i wieczory DJ-skie. Kameralny klimat, świetna kawa i lojalni goście.',
    ad_url: 'https://grouaistream.com',
    ad_image_url: 'https://bvstvawnigyczvofzhps.supabase.co/storage/v1/object/public/email-assets/ad-outreach-hero-v2.jpg',
    industry: 'Kawiarnia',
    amount_eur: 5,
    payment_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    post_url: 'https://grouaistream.com/blog/ad-demo',
  },
} satisfies TemplateEntry

const body = {
  backgroundColor: '#ffffff',
  color: '#101010',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  margin: 0,
  padding: '24px 0',
}

const container = {
  maxWidth: '620px',
  margin: '0 auto',
  backgroundColor: '#0f0f17',
  borderRadius: '24px',
  overflow: 'hidden' as const,
}

const heroSection = {
  padding: '32px 32px 12px',
  background: 'linear-gradient(180deg, #181824 0%, #0f0f17 100%)',
}

const eyebrow = {
  margin: '0 0 10px',
  color: '#ff6b1a',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '1.4px',
  textTransform: 'uppercase' as const,
}

const h1 = {
  margin: '0 0 12px',
  color: '#ffffff',
  fontSize: '32px',
  lineHeight: '1.1',
  fontWeight: 800,
}

const lead = {
  margin: 0,
  color: '#cfcfdc',
  fontSize: '15px',
  lineHeight: '1.7',
}

const priceCard = {
  margin: '0 32px',
  background: 'linear-gradient(135deg, rgba(255,107,26,0.18) 0%, rgba(255,180,0,0.14) 100%)',
  border: '1px solid rgba(255,107,26,0.38)',
  borderRadius: '18px',
  padding: '24px',
  textAlign: 'center' as const,
}

const priceLabel = {
  margin: '0 0 6px',
  color: '#ffb45c',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '1.6px',
  textTransform: 'uppercase' as const,
}

const priceValue = {
  margin: '0 0 6px',
  color: '#ffffff',
  fontSize: '40px',
  lineHeight: '1',
  fontWeight: 800,
}

const priceNote = {
  margin: 0,
  color: '#cfcfdc',
  fontSize: '13px',
  lineHeight: '1.6',
}

const contentSection = {
  padding: '28px 32px 36px',
}

const sectionTitle = {
  margin: '0 0 14px',
  color: '#ffffff',
  fontSize: '21px',
  lineHeight: '1.3',
  fontWeight: 700,
}

const detailBox = {
  backgroundColor: '#171722',
  border: '1px solid #26263a',
  borderRadius: '14px',
  padding: '14px 16px',
  margin: '0 0 12px',
}

const detailBoxLarge = {
  backgroundColor: '#171722',
  border: '1px solid #26263a',
  borderRadius: '14px',
  padding: '16px',
  margin: '0 0 12px',
}

const detailLabel = {
  margin: '0 0 6px',
  color: '#9f9fb3',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '1.2px',
  textTransform: 'uppercase' as const,
}

const detailValue = {
  margin: 0,
  color: '#ffffff',
  fontSize: '15px',
  lineHeight: '1.6',
  fontWeight: 600,
}

const detailText = {
  margin: 0,
  color: '#d7d7e2',
  fontSize: '14px',
  lineHeight: '1.8',
}

const linkValue = {
  color: '#ff8a3d',
  fontSize: '14px',
  lineHeight: '1.7',
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
}

const imageWrapper = {
  margin: '0 0 12px',
}

const image = {
  width: '100%',
  height: 'auto',
  display: 'block',
  borderRadius: '16px',
  border: '1px solid #26263a',
}

const divider = {
  borderColor: '#2a2a3a',
  margin: '24px 0',
}

const paragraph = {
  margin: '0 0 16px',
  color: '#cfcfdc',
  fontSize: '14px',
  lineHeight: '1.7',
}

const ctaSection = {
  textAlign: 'center' as const,
  margin: '0 0 14px',
}

const ctaButton = {
  background: 'linear-gradient(135deg, #ff6b1a, #ffb400)',
  color: '#0f0f17',
  padding: '15px 28px',
  borderRadius: '12px',
  fontSize: '15px',
  fontWeight: 800,
  textDecoration: 'none',
  display: 'inline-block' as const,
}

const fallbackLink = {
  color: '#ff8a3d',
  fontSize: '13px',
  lineHeight: '1.7',
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
}
