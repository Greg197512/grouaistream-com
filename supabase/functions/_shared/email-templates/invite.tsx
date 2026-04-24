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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Zaproszenie do {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Img src={LOGO_URL} alt={siteName} style={logo} />
          <Text style={wordmark}>GrouAI Stream</Text>
        </Section>

        <Section style={card}>
          <Heading style={h1}>Masz zaproszenie 🎁</Heading>
          <Text style={text}>
            Ktoś z{' '}
            <Link href={siteUrl} style={link}>
              <strong>{siteName}</strong>
            </Link>{' '}
            zaprosił Cię, żebyś dołączył do przestrzeni, w której muzyka
            naprawdę zaczyna słuchać Ciebie. Kliknij, aby zaakceptować
            zaproszenie i utworzyć konto.
          </Text>

          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>
              Przyjmij zaproszenie
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
            Nie spodziewałeś się tego zaproszenia? Możesz spokojnie zignorować
            tę wiadomość.
          </Text>
        </Section>

        <Text style={footerBrand}>
          <Link href={siteUrl} style={{ color: '#a1a1aa', textDecoration: 'none' }}>
            {siteName}
          </Link>{' '}
          · Witaj w domu
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
