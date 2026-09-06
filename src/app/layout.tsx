import type { Metadata, Viewport } from 'next'

// PENTING: tanpa ini halaman di-prerender saat build, sehingga identitas, warna,
// dan tema hanya dibaca SEKALI waktu deploy — mengubahnya dari Admin tidak akan
// pernah tampil sampai deploy berikutnya. (Terbukti: warna tersimpan sebelum
// deploy tampil, tema yang dipilih sesudahnya tidak.)
//
// `dynamic = 'force-dynamic'` di src/app/menu/page.tsx TIDAK berlaku karena file
// itu 'use client' — penanda segmen rute di file client diabaikan. Jadi harus
// dipasang di sini, di layout yang memang server component.
//
// Dipakai revalidate (bukan force-dynamic) supaya halaman tetap di-cache CDN —
// penting karena menu dibuka pakai kuota pelanggan di HP mereka.
export const revalidate = 30
import { DM_Sans, Playfair_Display } from 'next/font/google'
import './globals.css'
import { BRAND, BRAND_NICE, BRAND_FULL, BRAND_RGB, BRAND_RGB_PRIMARY_DARK, BRAND_HEX, BRAND_GLOBAL, applyBrand } from '@/lib/brand'
import { loadBrandFromDb } from '@/lib/brand-server'
import { themeCss } from '@/lib/themes'

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

// Metadata dibuat per-request supaya ikut identitas dari database
export async function generateMetadata(): Promise<Metadata> {
  applyBrand(await loadBrandFromDb())
  const T = `${BRAND_FULL} — ${BRAND.city}`
  const kota = BRAND.city.toLowerCase()
  return {
    title: { default: T, template: `%s | ${BRAND_NICE}` },
    description: `${BRAND_FULL} di ${BRAND.city} — specialty coffee, ruang nongkrong yang cozy, dan momen-momen terbaik. Scan QR di meja untuk pesan langsung dari HP.`,
    keywords: [`kafe ${kota}`, `coffee shop ${kota}`, BRAND_NICE.toLowerCase(), `tempat nongkrong ${kota}`],
    manifest: '/manifest.json',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: BRAND_NICE },
    icons: { icon: '/icon.svg', apple: '/icon.svg' },
    openGraph: {
      type: 'website', locale: 'id_ID', title: BRAND_FULL,
      description: `Specialty coffee & tempat nongkrong terbaik di ${BRAND.city}. Scan QR di meja, pesan dari HP, langsung diantar.`,
      siteName: `${BRAND_NICE} Café`,
    },
    twitter: {
      card: 'summary_large_image', title: BRAND_FULL,
      description: `Specialty coffee & tempat nongkrong terbaik di ${BRAND.city}.`,
    },
  }
}

export async function generateViewport(): Promise<Viewport> {
  applyBrand(await loadBrandFromDb())
  return { themeColor: BRAND_HEX }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Muat identitas outlet dari DB SEBELUM render, supaya HTML yang dikirim
  // sudah benar (tidak ada kedipan identitas Hallu dulu).
  const dariDb = await loadBrandFromDb()
  applyBrand(dariDb)

  // Disuntik ke browser sebelum bundle jalan → modul brand.ts di client
  // langsung memakai nilai yang sama (tidak ada beda server vs client).
  const bootScript = `window.${BRAND_GLOBAL}=${JSON.stringify(BRAND)};`
  // Warna brand + token tema (permukaan & sudut). Keduanya dikirim sebagai CSS
  // variable supaya ganti tema dari Admin langsung tampil tanpa deploy ulang.
  const cssVars = `:root{--brand-primary:${BRAND_RGB.primary};--brand-primary-dark:${BRAND_RGB_PRIMARY_DARK};--brand-accent:${BRAND_RGB.accent};--brand-primary-hex:${BRAND_HEX};${themeCss(BRAND.theme)}}`

  return (
    <html lang="id">
      <head>
        <meta name="theme-color" content={BRAND_HEX} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      </head>
      <body className={`${dmSans.variable} ${playfair.variable} font-sans`}>
        {children}
      </body>
    </html>
  )
}
