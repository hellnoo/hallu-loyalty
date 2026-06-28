import type { Metadata, Viewport } from 'next'
import { DM_Sans, Playfair_Display } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600', '700'],
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['700', '900'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: {
    default: 'Hallu Coffee & Sociality — Ternate',
    template: '%s | Hallu',
  },
  description: 'Hallu Coffee & Sociality di Ternate — specialty coffee, ruang nongkrong yang cozy, dan momen-momen terbaik. Scan QR di meja untuk pesan langsung dari HP.',
  keywords: ['kafe ternate', 'coffee shop ternate', 'hallu', 'specialty coffee ternate', 'tempat nongkrong ternate'],
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Hallu' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    title: 'Hallu Coffee & Sociality',
    description: 'Specialty coffee & tempat nongkrong terbaik di Ternate. Scan QR di meja, pesan dari HP, langsung diantar.',
    siteName: 'Hallu Café',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hallu Coffee & Sociality',
    description: 'Specialty coffee & tempat nongkrong terbaik di Ternate.',
  },
}

export const viewport: Viewport = {
  themeColor: '#7C1515',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <meta name="theme-color" content="#7C1515" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className={`${dmSans.variable} ${playfair.variable} font-sans`}>
        {children}
      </body>
    </html>
  )
}
