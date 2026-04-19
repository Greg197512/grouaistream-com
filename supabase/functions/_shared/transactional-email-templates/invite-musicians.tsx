import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'GrouAI Stream'
const SITE_URL = 'https://grouaistream.com'
const BLOG_URL = 'https://grouaistream.com/blog'
const UPLOAD_URL = 'https://grouaistream.com/upload'

interface InviteMusiciansProps {
  recipientName?: string
}

const InviteMusiciansEmail = ({ recipientName }: InviteMusiciansProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Wrzuć muzykę na GrouAI Stream i zarabiaj — to naprawdę proste</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={hero}>
          <Heading style={h1}>🎧 Twoja muzyka. Twoja kasa.</Heading>
          <Text style={subtitle}>
            {recipientName ? `Cześć ${recipientName}!` : 'Cześć!'} Mamy coś, co może Cię zainteresować.
          </Text>
        </Section>

        <Section style={content}>
          <Text style={text}>
            Jesteśmy <strong>GrouAI Stream</strong> — platforma muzyczna nowej generacji,
            w której <strong>artyści naprawdę zarabiają</strong> na swoich utworach. Bez pośredników,
            bez wyzysku, bez czekania pół roku na grosze ze streamów.
          </Text>

          <Heading style={h2}>💸 Co dostajesz?</Heading>
          <Text style={text}>
            • <strong>100% przychodów z napiwków</strong> od słuchaczy<br/>
            • <strong>Realne stawki za każdy stream</strong> (nie ułamki centa jak gdzie indziej)<br/>
            • <strong>Bonusy za milestones</strong> — pierwsze 100, 1000, 10000 odsłuchań<br/>
            • <strong>Weekend Challenges</strong> z dodatkową pulą nagród<br/>
            • <strong>Wypłaty na konto</strong> bez progów ukrytych w gwiazdkach
          </Text>

          <Heading style={h2}>🚀 Co potrafi platforma?</Heading>
          <Text style={text}>
            • AI-DJ który miksuje Twoje utwory z innymi w czasie rzeczywistym<br/>
            • Radio na żywo z czatem i lajkami<br/>
            • Generowanie okładek przez AI<br/>
            • Sesje DJ z QR kodem dla Twoich fanów<br/>
            • Import z YouTube, Spotify, własne pliki<br/>
            • Empatyczny asystent który rozumie nastrój słuchaczy
          </Text>

          <Section style={ctaSection}>
            <Button href={UPLOAD_URL} style={ctaButton}>
              Wrzuć pierwszy utwór →
            </Button>
          </Section>

          <Hr style={hr} />

          <Heading style={h2}>📚 Sprawdź nasz blog</Heading>
          <Text style={text}>
            Piszemy o produkcji muzycznej, AI w muzyce, monetyzacji, promocji,
            psychologii dźwięku i kulisach branży. <strong>Naprawdę się tam dużo dowiesz</strong> —
            artykuły są długie, konkretne i pisane przez ludzi, którzy w tym siedzą.
          </Text>

          <Section style={ctaSection}>
            <Button href={BLOG_URL} style={ctaSecondary}>
              Przeczytaj blog →
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={text}>
            Bez ściemy: rejestracja zajmuje 30 sekund, upload utworu kolejne 30.
            Nie pobieramy opłat za wejście, nie blokujemy Twoich praw, nie zmuszamy do exclusivity.
            Możesz wrzucać równolegle gdziekolwiek chcesz.
          </Text>

          <Text style={text}>
            <Link href={SITE_URL} style={link}>grouaistream.com</Link> — wpadnij i sprawdź sam.
          </Text>

          <Text style={signature}>
            Do usłyszenia,<br/>
            <strong>Ekipa GrouAI Stream</strong>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InviteMusiciansEmail,
  subject: '🎧 Wrzuć swoją muzykę na GrouAI Stream i zarabiaj realnie',
  displayName: 'Zaproszenie dla muzyków',
  previewData: { recipientName: 'Marek' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { maxWidth: '600px', margin: '0 auto', padding: '20px 25px' }
const hero = { textAlign: 'center' as const, padding: '20px 0 30px' }
const h1 = { fontSize: '28px', fontWeight: 'bold', color: '#000000', margin: '0 0 12px' }
const subtitle = { fontSize: '16px', color: '#55575d', margin: '0' }
const content = { padding: '0' }
const h2 = { fontSize: '18px', fontWeight: 'bold', color: '#000000', margin: '24px 0 10px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const ctaSection = { textAlign: 'center' as const, margin: '24px 0' }
const ctaButton = {
  backgroundColor: '#FF6B00',
  color: '#ffffff',
  padding: '14px 32px',
  borderRadius: '8px',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  display: 'inline-block',
}
const ctaSecondary = {
  backgroundColor: '#000000',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 'bold',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#eaeaea', margin: '28px 0' }
const link = { color: '#FF6B00', textDecoration: 'underline' }
const signature = { fontSize: '14px', color: '#55575d', margin: '24px 0 0' }
