/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import {
  LOGO_URL,
  main,
  container,
  headerSection,
  logo,
  wordmark,
  card,
  h1,
  text,
  link,
  button,
  buttonWrap,
  divider,
  footer,
  footerBrand,
} from './_brand.ts'

interface RecoveryEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Zresetuj swoje hasło w {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Img src={LOGO_URL} alt={siteName} style={logo} />
          <Text style={wordmark}>GrouAI Stream</Text>
        </Section>

        <Section style={card}>
          <Heading style={h1}>Zresetuj hasło 🔐</Heading>
          <Text style={text}>
            Otrzymaliśmy prośbę o zresetowanie Twojego hasła w {siteName}.
            Kliknij przycisk poniżej, aby ustawić nowe hasło — link działa
            tylko przez chwilę.
          </Text>

          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>
              Ustaw nowe hasło
            </Button>
          </Section>

          <Text style={{ ...text, fontSize: '13px', color: '#71717a' }}>
            Link nie działa? Wklej ten adres do przeglądarki:
            <br />
            <Link href={confirmationUrl} style={{ ...link, wordBreak: 'break-all' }}>
              {confirmationUrl}
            </Link>
          </Text>

          <Hr style={divider} />

          <Text style={footer}>
            Jeśli to nie Ty prosiłeś o reset, zignoruj tę wiadomość — Twoje
            hasło zostaje bez zmian.
          </Text>
        </Section>

        <Text style={footerBrand}>
          <Link href={siteUrl} style={{ color: '#a1a1aa', textDecoration: 'none' }}>
            {siteName}
          </Link>{' '}
          · Twoja przestrzeń dźwięku
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
