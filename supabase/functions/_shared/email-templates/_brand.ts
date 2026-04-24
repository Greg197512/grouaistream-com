// Wspólny styl wszystkich e-maili auth GrouAI Stream.
// Body MUSI mieć białe tło (wymóg brandowy poczty), akcenty pomarańczowe.

export const LOGO_URL =
  'https://bvstvawnigyczvofzhps.supabase.co/storage/v1/object/public/email-assets/grouai-logo.png'

export const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  margin: 0,
  padding: '24px 0',
}

export const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '0 24px',
}

export const headerSection = {
  textAlign: 'center' as const,
  padding: '24px 0 8px',
}

export const logo = {
  width: '56px',
  height: '56px',
  margin: '0 auto',
  borderRadius: '12px',
}

export const wordmark = {
  fontFamily:
    "'Space Grotesk', 'Inter', Helvetica, Arial, sans-serif",
  fontSize: '20px',
  fontWeight: 700 as const,
  color: '#0a0a0a',
  letterSpacing: '0.02em',
  margin: '12px 0 0',
}

export const card = {
  background: '#ffffff',
  border: '1px solid #ececec',
  borderRadius: '16px',
  padding: '32px 28px',
  marginTop: '20px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
}

export const h1 = {
  fontFamily:
    "'Space Grotesk', 'Inter', Helvetica, Arial, sans-serif",
  fontSize: '24px',
  fontWeight: 700 as const,
  color: '#0a0a0a',
  margin: '0 0 16px',
  lineHeight: '1.25',
}

export const text = {
  fontSize: '15px',
  color: '#3f3f46',
  lineHeight: '1.6',
  margin: '0 0 18px',
}

export const link = {
  color: '#FF4A1C',
  textDecoration: 'underline',
  fontWeight: 600 as const,
}

export const button = {
  backgroundColor: '#FF4A1C',
  backgroundImage:
    'linear-gradient(135deg, #FF4A1C 0%, #FFA500 100%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700 as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
  textAlign: 'center' as const,
  letterSpacing: '0.01em',
}

export const buttonWrap = {
  textAlign: 'center' as const,
  margin: '8px 0 24px',
}

export const codeBox = {
  background: '#0a0a0a',
  color: '#FFA500',
  fontFamily: "'SFMono-Regular', Consolas, 'Courier New', monospace",
  fontSize: '32px',
  fontWeight: 700 as const,
  letterSpacing: '0.4em',
  padding: '20px',
  borderRadius: '12px',
  textAlign: 'center' as const,
  margin: '8px 0 24px',
}

export const divider = {
  borderTop: '1px solid #ececec',
  margin: '28px 0 20px',
}

export const footer = {
  fontSize: '12px',
  color: '#71717a',
  lineHeight: '1.6',
  margin: '0',
  textAlign: 'center' as const,
}

export const footerBrand = {
  fontSize: '12px',
  color: '#a1a1aa',
  margin: '12px 0 0',
  textAlign: 'center' as const,
}
