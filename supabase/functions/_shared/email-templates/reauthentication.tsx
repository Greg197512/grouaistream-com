/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
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
  codeBox,
  divider,
  footer,
  footerBrand,
} from './_brand.ts'

interface ReauthenticationEmailProps {
  token: string
  siteName?: string
}

export const ReauthenticationEmail = ({
  token,
  siteName = 'GrouAI Stream',
}: ReauthenticationEmailProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Twój kod weryfikacyjny: {token}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Img src={LOGO_URL} alt={siteName} style={logo} />
          <Text style={wordmark}>GrouAI Stream</Text>
        </Section>

        <Section style={card}>
          <Heading style={h1}>Twój kod weryfikacyjny 🔑</Heading>
          <Text style={text}>
            Użyj poniższego kodu, aby potwierdzić swoją tożsamość. Kod wygasa
            za chwilę.
          </Text>

          <Text style={codeBox}>{token}</Text>

          <Hr style={divider} />

          <Text style={footer}>
            Nie prosiłeś o ten kod? Możesz spokojnie zignorować tę wiadomość —
            ale jeśli powtarza się to często, zmień hasło dla pewności.
          </Text>
        </Section>

        <Text style={footerBrand}>{siteName} · Bezpieczeństwo przede wszystkim</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
