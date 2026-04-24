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

interface MagicLinkEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Twój magiczny link do {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Img src={LOGO_URL} alt={siteName} style={logo} />
          <Text style={wordmark}>GrouAI Stream</Text>
        </Section>

        <Section style={card}>
          <Heading style={h1}>Twój magiczny link ✨</Heading>
          <Text style={text}>
            Kliknij przycisk poniżej, aby błyskawicznie zalogować się do {siteName}.
            Bez hasła, bez kombinowania. Link wygasa za chwilę.
          </Text>

          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>
              Zaloguj mnie
            </Button>
          </Section>

          <Text style={{ ...text, fontSize: '13px', color: '#71717a' }}>
            Link nie działa? Skopiuj go do przeglądarki:
            <br />
            <Link href={confirmationUrl} style={{ ...link, wordBreak: 'break-all' }}>
              {confirmationUrl}
            </Link>
          </Text>

          <Hr style={divider} />

          <Text style={footer}>
            Nie prosiłeś o ten link? Po prostu zignoruj tę wiadomość.
          </Text>
        </Section>

        <Text style={footerBrand}>
          <Link href={siteUrl} style={{ color: '#a1a1aa', textDecoration: 'none' }}>
            {siteName}
          </Link>{' '}
          · Witaj z powrotem
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
