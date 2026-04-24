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

interface EmailChangeEmailProps {
  siteName: string
  siteUrl: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  siteUrl,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Potwierdź zmianę adresu e-mail w {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Img src={LOGO_URL} alt={siteName} style={logo} />
          <Text style={wordmark}>GrouAI Stream</Text>
        </Section>

        <Section style={card}>
          <Heading style={h1}>Potwierdź zmianę e-maila ✉️</Heading>
          <Text style={text}>
            Poprosiłeś o zmianę adresu e-mail w {siteName} z{' '}
            <Link href={`mailto:${email}`} style={link}>
              {email}
            </Link>{' '}
            na{' '}
            <Link href={`mailto:${newEmail}`} style={link}>
              {newEmail}
            </Link>
            .
          </Text>
          <Text style={text}>
            Kliknij przycisk poniżej, żeby potwierdzić tę zmianę:
          </Text>

          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>
              Potwierdź zmianę
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
            Nie prosiłeś o tę zmianę? Natychmiast zabezpiecz swoje konto i zmień
            hasło.
          </Text>
        </Section>

        <Text style={footerBrand}>
          <Link href={siteUrl} style={{ color: '#a1a1aa', textDecoration: 'none' }}>
            {siteName}
          </Link>{' '}
          · Bezpieczeństwo Twojego konta
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
