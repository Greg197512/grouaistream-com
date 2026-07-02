import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
}

const FoundingMemberEmail = ({ recipientName }: Props) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Masz 2 minuty? Buduję coś nowego w GrouAI Stream</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={content}>
          <Text style={text}>Cześć {recipientName || ''},</Text>

          <Text style={text}>
            Jesteś jednym z niewielu ludzi, którzy realnie korzystają z GrouAI Stream —
            i to się dla mnie liczy dużo bardziej niż liczba rejestracji.
          </Text>

          <Text style={text}>Mam do Ciebie dwie sprawy:</Text>

          <Text style={text}>
            <strong>1) Chcę wiedzieć, czego Ci brakuje.</strong> Co Cię irytuje, czego nie ma,
            co by Cię przekonało do zostania na dłużej? Odpowiedz jednym zdaniem, wystarczy.
          </Text>

          <Text style={text}>
            <strong>2) Otwieram ograniczoną liczbę miejsc „Founding Member"</strong> —
            jednorazowa opłata <strong>29€</strong> zamiast miesięcznej subskrypcji,
            dożywotni dostęp do pełnej wersji + Twoje imię/nick w podziękowaniach na stronie.
            To dla ludzi, którzy byli tu od początku.
          </Text>

          <Text style={text}>
            Jeśli jesteś zainteresowany/a, po prostu odpisz <strong>„tak"</strong> na ten mail
            lub napisz na{' '}
            <Link href="mailto:grouarock@gmail.com" style={link}>grouarock@gmail.com</Link>
            {' '}— wyślę Ci link.
          </Text>

          <Text style={text}>Dzięki, że tu jesteś.</Text>

          <Text style={signature}>
            Grzegorz<br/>
            <strong>GrouAI Stream</strong>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: FoundingMemberEmail,
  subject: 'Masz 2 minuty? Buduję coś nowego w GrouAI Stream',
  displayName: 'Founding Member — zaproszenie',
  previewData: { recipientName: 'Marek' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { maxWidth: '600px', margin: '0 auto', padding: '24px 25px' }
const content = { padding: '0' }
const text = { fontSize: '15px', color: '#222222', lineHeight: '1.7', margin: '0 0 16px' }
const link = { color: '#FF6B00', textDecoration: 'underline', fontWeight: 600 as const }
const signature = { fontSize: '15px', color: '#222222', margin: '28px 0 0', lineHeight: '1.6' }
