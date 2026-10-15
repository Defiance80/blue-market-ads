import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Archivo is a variable font with weight AND width axes (bundled in
// app/fonts, SIL Open Font License). The width axis lets us set expanded
// headings and condensed figures from one family.
const archivo = localFont({
  src: './fonts/Archivo-Variable.woff2',
  variable: '--font-archivo',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Blue Market Ads', template: '%s · Blue Market Ads' },
  description: 'Google Ads and Local Services Ads management for the Blue Market team.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
