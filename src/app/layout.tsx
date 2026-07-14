import type { Metadata, Viewport } from 'next'
import { DM_Sans, Playfair_Display } from 'next/font/google'
import './globals.css'
import { BRAND, BRAND_NICE, BRAND_FULL } from '@/lib/brand'

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

const T = `${BRAND_FULL} — ${BRAND.city}`

export const metadata: Metadata = {
  title: {
    default: T,
    template: `%s | ${BRAND_NICE}`,
  },
  description: `${BRAND_FULL} di ${BRAND.city} — specialty coffee, ruang nongkrong yang cozy, dan momen-momen terbaik. Scan QR di meja untuk pesan langsung dari HP.`,
  keywords: [`kafe ${BRAND.city.toLowerCase()}`, `coffee shop ${BRAND.city.toLowerCase()}`, BRAND_NICE.toLowerCase(), `tempat nongkrong ${BRAND.city.toLowerCase()}`],
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: BRAND_NICE },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    title: BRAND_FULL,
    description: `Specialty coffee & tempat nongkrong terbaik di ${BRAND.city}. Scan QR di meja, pesan dari HP, langsung diantar.`,
    siteName: `${BRAND_NICE} Café`,
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND_FULL,
    description: `Specialty coffee & tempat nongkrong terbaik di ${BRAND.city}.`,
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
