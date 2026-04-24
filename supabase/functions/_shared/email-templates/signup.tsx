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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Potwierdź swój e-mail w {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Img src={LOGO_URL} alt={siteName} style={logo} />
          <Text style={wordmark}>GrouAI Stream</Text>
        </Section>

        <Section style={card}>
          <Heading style={h1}>Witaj w przestrzeni, w której muzyka słucha Ciebie 🎧</Heading>
          <Text style={text}>
            Cieszymy się, że jesteś. Zostało jedno kliknięcie, żebyś mógł zacząć
            rozmawiać z muzyką, tworzyć własne utwory i wpadać w aurorę dźwięku.
          </Text>
          <Text style={text}>
            Potwierdź swój adres{' '}
            <Link href={`mailto:${recipient}`} style={link}>
              {recipient}
            </Link>
            , klikając przycisk poniżej:
          </Text>

          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>
              Aktywuj konto
            </Button>
          </Section>

          <Text style={{ ...text, fontSize: '13px', color: '#71717a' }}>
            Link nie działa? Skopiuj ten adres do przeglądarki:
            <br />
            <Link href={confirmationUrl} style={{ ...link, wordBreak: 'break-all' }}>
              {confirmationUrl}
            </Link>
          </Text>

          <Hr style={divider} />

          <Text style={footer}>
            Jeśli to nie Ty rejestrowałeś konto, po prostu zignoruj tę wiadomość —
            nic się nie wydarzy.
          </Text>
        </Section>

        <Text style={footerBrand}>
          <Link href={siteUrl} style={{ color: '#a1a1aa', textDecoration: 'none' }}>
            {siteName}
          </Link>{' '}
          · Muzyka, która patrzy Ci w oczy
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
