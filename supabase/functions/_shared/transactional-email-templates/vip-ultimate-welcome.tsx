/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Link, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props { name?: string }

const Email = ({ name = 'Darek' }: Props) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Twoje konto VIP Ultimate jest aktywne — witaj na szczycie GrouAI Stream</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#000000', margin: 0, padding: 0 }}>
      <Container style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
        <Section style={{ background: 'linear-gradient(135deg,#ff6a00,#ffb300)', borderRadius: 16, padding: 28, textAlign: 'center' as const, color: '#ffffff' }}>
          <Text style={{ fontSize: 42, margin: 0 }}>👑</Text>
          <Heading style={{ margin: '8px 0 0', fontSize: 26, color: '#ffffff' }}>VIP Ultimate aktywne</Heading>
          <Text style={{ margin: '4px 0 0', color: '#ffffff', opacity: 0.95 }}>Witaj na szczycie GrouAI Stream</Text>
        </Section>

        <Text style={{ marginTop: 24, fontSize: 16 }}>Cześć {name}! 🎸</Text>
        <Text>Mam dla Ciebie świetną wiadomość — <b>Twoje konto zostało właśnie podniesione do najwyższego poziomu: VIP Ultimate</b> 👑</Text>
        <Text>Od tej chwili masz odblokowane <b>wszystko, co GrouAI Stream potrafi najlepszego</b>:</Text>

        <Section style={{ background: '#fff7ed', border: '1px solid #ffd9a8', borderRadius: 12, padding: 16 }}>
          <Text style={{ margin: '4px 0' }}>🎙️ <b>GrouAI Studio bez limitów</b> — tworzenie muzyki z AI (MusicGen + ACE-Step z wokalem PL/EN/NL/UA)</Text>
          <Text style={{ margin: '4px 0' }}>🎬 <b>Generator teledysków VIP</b> — MiniMax + Lip-sync (LatentSync) w najwyższej jakości</Text>
          <Text style={{ margin: '4px 0' }}>🎵 <b>FLAC audio</b> — bezstratna jakość dźwięku</Text>
          <Text style={{ margin: '4px 0' }}>🤖 <b>AI DJ</b> — Twój osobisty didżej, który uczy się Twojego gustu</Text>
          <Text style={{ margin: '4px 0' }}>⚡ <b>Kolejka priorytetowa</b> — generujesz szybciej niż wszyscy inni</Text>
          <Text style={{ margin: '4px 0' }}>💛 <b>Odznaka Ultimate</b> widoczna w Twoim profilu</Text>
        </Section>

        <Hr style={{ border: 'none', borderTop: '1px solid #eeeeee', margin: '24px 0' }} />

        <Heading as="h2" style={{ color: '#ff6a00', margin: '0 0 8px', fontSize: 20 }}>💸 Zarabianie — ostatni krok do wypłat</Heading>
        <Text>Twoje utwory już zarabiają na platformie (streamy 65%, tipy 90%, boosty 70%). Żebyśmy mogli <b>przelać Ci pieniądze na konto</b>, potrzebuję od Ciebie:</Text>
        <Text style={{ margin: '4px 0' }}>1. <b>Imię i nazwisko</b> (do przelewu)</Text>
        <Text style={{ margin: '4px 0' }}>2. <b>Miejscowość</b></Text>
        <Text style={{ margin: '4px 0' }}>3. <b>Numer konta (IBAN)</b></Text>

        <Text>Możesz to zrobić na dwa sposoby:</Text>
        <Text style={{ margin: '4px 0' }}>• <b>Szybciej:</b> wejdź na <Link href="https://www.grouaistream.com/earnings" style={{ color: '#ff6a00' }}>grouaistream.com/earnings</Link> → <i>Wypłać środki</i> i wypełnij formularz (dane szyfrowane, trafiają bezpośrednio do mnie)</Text>
        <Text style={{ margin: '4px 0' }}>• <b>Albo:</b> odpisz na tego maila — wpiszę Ci ręcznie</Text>

        <Text><b>Wypłaty realizuję w ciągu 24h</b> od zatwierdzenia. Pierwsza wypłata to zawsze fajny moment — chcę, żebyś go poczuł jak najszybciej 🚀</Text>

        <Hr style={{ border: 'none', borderTop: '1px solid #eeeeee', margin: '24px 0' }} />

        <Text>Dzięki, że tworzysz razem ze mną tę platformę. Bez takich twórców jak Ty GrouAI Stream byłby tylko kolejnym playerem — a jest czymś więcej. 💛</Text>
        <Text style={{ marginTop: 20 }}>Do usłyszenia w eterze,<br /><b>Zespół GrouAI Stream</b><br />🎧 <Link href="https://grouaistream.com" style={{ color: '#ff6a00' }}>grouaistream.com</Link></Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: '👑 Twoje konto VIP Ultimate jest aktywne — witaj na szczycie GrouAI Stream',
  displayName: 'VIP Ultimate Welcome',
  previewData: { name: 'Darek' },
} satisfies TemplateEntry
