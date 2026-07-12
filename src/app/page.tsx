'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { MenuItem, StoreSettings } from '@/types'
import { formatRp } from '@/lib/format'
import { calcIsOpen } from '@/lib/store-hours'
import {
  InstagramIcon, TikTokIcon, WhatsAppIcon, CoffeeIcon, UsersIcon,
  QrIcon, MapPinIcon, ClockIcon, PhoneIcon, NavigationIcon, ArrowIcon,
} from '@/components/icons'

const WA = 'https://wa.me/6281245400031'
const IG = 'https://instagram.com/hall.ucffe'
const TIKTOK = 'https://tiktok.com/@hall.ucffe'
const IG_HANDLE = '@hall.ucffe'

// ── Lokasi Hallu ──────────────────────────────────────────
// Titik Taman Fitness Sunyie Parade / Cafe Taman Fitness (Google Maps, plus code Q9VP+C69)
const LOC = {
  lat: 0.7935511,
  lng: 127.3855782,
  label: 'Hallu Coffee & Sociality',
  address: 'Taman Fitness Sunyie Parade, Ternate, Maluku Utara',
}
const mapsEmbed = `https://maps.google.com/maps?q=${LOC.lat},${LOC.lng}&z=17&output=embed`
const mapsDirections = `https://www.google.com/maps/dir/?api=1&destination=${LOC.lat},${LOC.lng}`
const mapsView = `https://www.google.com/maps/search/?api=1&query=${LOC.lat},${LOC.lng}`


const CAT_ICONS: Record<string, string> = {
  'Kopi': '☕', 'Non-Kopi': '🥤', 'Makanan': '🍽️', 'Lainnya': '✨',
}

function generatePlaceholder(item: MenuItem): string {
  const icon = CAT_ICONS[item.category] || '☕'
  const name = item.name.length > 18 ? item.name.slice(0, 17) + '…' : item.name
  const safeName = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#7C1515"/><stop offset="100%" stop-color="#2D0808"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="45%" r="45%">
        <stop offset="0%" stop-color="#A02020" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
    </defs>
    <rect width="400" height="240" fill="url(#g)"/>
    <rect width="400" height="240" fill="url(#glow)"/>
    <text x="200" y="108" text-anchor="middle" font-size="58" opacity="0.9">${icon}</text>
    <text x="200" y="158" text-anchor="middle" font-family="system-ui,sans-serif" font-size="17" font-weight="700" fill="rgba(255,255,255,0.88)">${safeName}</text>
    <text x="200" y="208" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="rgba(212,184,150,0.4)" letter-spacing="5">HALLU</text>
  </svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

const ANIMS = ['animate-kenburns', 'animate-float-zoom', 'animate-drift', 'animate-tilt3d']
function pickAnim(id: string) {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return ANIMS[hash % ANIMS.length]
}
function leakDelay(id: string) { return -((id.charCodeAt(0) % 10) * 1.1) }

function MenuCard({ item, index }: { item: MenuItem; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.08 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={cardRef}
      className="flex-shrink-0 w-52 bg-h-card border border-h-border rounded-2xl overflow-hidden snap-start"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
        transition: `opacity 0.5s ease ${index * 80}ms, transform 0.5s ease ${index * 80}ms`,
      }}>
      <div className="relative h-36 overflow-hidden shine-overlay light-leak"
        style={{ '--leak-delay': `${leakDelay(item.id)}s` } as React.CSSProperties}>
        <img ref={imgRef} src={item.image_url || generatePlaceholder(item)} alt={item.name}
          className={`w-full h-full object-cover ${pickAnim(item.id)}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-h-card via-h-card/10 to-transparent" />
        <span className="absolute top-2.5 left-3 text-lg">{CAT_ICONS[item.category] || '☕'}</span>
      </div>
      <div className="p-3.5">
        <div className="font-bold text-white text-sm leading-tight">{item.name}</div>
        {item.description && <div className="text-h-muted text-[11px] mt-1 line-clamp-1">{item.description}</div>}
        <div className="text-h-cream font-black text-sm mt-2">{formatRp(item.price)}</div>
      </div>
    </div>
  )
}

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} className={className}
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(28px)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}>
      {children}
    </div>
  )
}

export default function Home() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [navScrolled, setNavScrolled] = useState(false)
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null)

  useEffect(() => {
    supabase.from('menu_items').select('*').eq('available', true).order('category').order('name').limit(12)
      .then(({ data }) => { if (data) setMenuItems(data as MenuItem[]) })
    supabase.from('store_settings').select('*').eq('id', 1).single()
      .then(({ data }) => { if (data) setStoreSettings(data as StoreSettings) })
  }, [])

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-h-bg text-white overflow-x-hidden">

      {/* ── Sticky Nav ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navScrolled ? 'bg-h-dark/90 backdrop-blur-md border-b border-h-border' : ''}`}>
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <div className="font-sans font-black text-white tracking-widest text-lg uppercase leading-none">HALLU</div>
            <div className="text-h-cream text-[0.45rem] tracking-[3px] uppercase font-semibold mt-0.5">Coffee &amp; Sociality</div>
          </div>
          <div className="flex items-center gap-2">
            <a href={IG} target="_blank" rel="noreferrer" aria-label="Instagram Hallu"
              title="Follow di Instagram"
              className="w-9 h-9 flex items-center justify-center rounded-full border border-h-border hover:border-pink-500/60 hover:text-pink-400 text-white/70 transition-colors">
              <InstagramIcon />
            </a>
            <a href={TIKTOK} target="_blank" rel="noreferrer" aria-label="TikTok Hallu"
              title="Follow di TikTok"
              className="w-9 h-9 flex items-center justify-center rounded-full border border-h-border hover:border-white/60 hover:text-white text-white/70 transition-colors">
              <TikTokIcon />
            </a>
            <a href={WA} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full text-xs font-bold transition-colors">
              <WhatsAppIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[520px] h-[520px] rounded-full animate-hero-glow"
            style={{ background: 'radial-gradient(circle, rgba(124,21,21,0.42) 0%, rgba(124,21,21,0.12) 45%, transparent 70%)' }} />
        </div>
        {/* Grain overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '200px' }} />

        <div className="relative z-10 max-w-lg">
          {/* Arabic */}
          <div className="font-serif text-7xl md:text-8xl font-black mb-2 leading-none"
            style={{ fontFamily: 'var(--font-playfair)', color: '#D4B896' }}>
            هالو
          </div>
          {/* Brand */}
          <div className="font-sans font-black text-h-cream text-4xl md:text-5xl tracking-[0.25em] uppercase mb-3">
            HALLU
          </div>
          {/* Divider */}
          <div className="flex items-center gap-3 justify-center mb-4">
            <div className="h-px flex-1 max-w-[60px]" style={{ background: 'linear-gradient(to right, transparent, #7C1515)' }} />
            <div className="text-h-cream text-[0.55rem] tracking-[4px] uppercase font-semibold">Coffee &amp; Sociality</div>
            <div className="h-px flex-1 max-w-[60px]" style={{ background: 'linear-gradient(to left, transparent, #7C1515)' }} />
          </div>
          {/* Tagline */}
          <p className="text-white/45 text-sm leading-relaxed max-w-sm mx-auto mt-3 mb-6">
            Specialty coffee dan ruang sosial untuk menemani momen terbaikmu di Ternate.
          </p>
          {/* Jam operasional */}
          {storeSettings && (() => {
            const open = calcIsOpen(storeSettings)
            return (
              <div className="flex items-center justify-center gap-3 mb-8">
                <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${open ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-h-red/15 text-h-cream border border-h-red/30'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-green-400 animate-pulse' : 'bg-h-red'}`} />
                  {open ? 'Buka Sekarang' : 'Sedang Tutup'}
                </span>
                <span className="text-white/30 text-xs">
                  {storeSettings.open_days} · {storeSettings.open_time}–{storeSettings.close_time}
                </span>
              </div>
            )
          })()}
          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/menu?table=1"
              className="flex items-center justify-center gap-2 bg-h-red hover:bg-h-red-d text-white px-8 py-3.5 rounded-full font-bold text-sm uppercase tracking-[0.15em] transition-colors">
              <CoffeeIcon className="w-4 h-4" /> Lihat Menu
            </a>
            <a href={WA} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 border border-h-border hover:border-white/30 text-white/70 hover:text-white px-8 py-3.5 rounded-full font-bold text-sm uppercase tracking-[0.15em] transition-colors">
              <WhatsAppIcon className="w-4 h-4 text-green-400" />
              Order via WA
            </a>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
          <div className="text-[10px] tracking-[3px] uppercase">Scroll</div>
          <div className="w-px h-8 bg-white/40 animate-pulse" />
        </div>
      </section>

      {/* ── Menu Preview ── */}
      <section className="py-20 px-0 overflow-hidden">
        <Section className="px-5 max-w-5xl mx-auto mb-8">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-h-cream text-[0.55rem] tracking-[4px] uppercase font-semibold mb-2">Pilihan Kami</div>
              <h2 className="font-sans font-black text-white text-3xl uppercase tracking-wider leading-none">Menu</h2>
            </div>
            <a href="/menu?table=1" className="text-h-cream text-xs font-bold hover:underline tracking-wider uppercase">
              Lihat Semua →
            </a>
          </div>
        </Section>

        {/* Horizontal scroll */}
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pl-5 pr-5 pb-4 scrollbar-hide">
          {menuItems.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-52 h-[220px] bg-h-card border border-h-border rounded-2xl animate-pulse" />
            ))
            : menuItems.map((item, i) => <MenuCard key={item.id} item={item} index={i} />)
          }
        </div>
      </section>

      {/* ── About Us ── */}
      <section className="py-20 px-5">
        <Section className="max-w-3xl mx-auto text-center">
          <div className="text-h-cream text-[0.55rem] tracking-[4px] uppercase font-semibold mb-3">Tentang Kami</div>
          <h2 className="font-sans font-black text-white text-3xl uppercase tracking-wider mb-6">Halo, kami Hallu</h2>
          <p className="text-white/60 text-base leading-relaxed mb-4">
            Hallu (هالو · &quot;halo&quot; dalam bahasa Arab) lahir dari satu ide sederhana —
            tempat di mana semua orang merasa <em className="text-h-cream not-italic font-semibold">disambut</em>.
          </p>
          <p className="text-white/50 text-sm leading-relaxed">
            Specialty coffee kami diracik dari biji pilihan, dipadukan dengan suasana
            yang hangat untuk ngobrol, bekerja, atau sekadar menikmati waktu sendiri.
            Bagi kami, secangkir kopi yang baik adalah tentang momen — bukan sekadar rasa.
          </p>
        </Section>
      </section>

      {/* ── Vibes ── */}
      <section className="py-20 px-5">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-5">
          {[
            { Icon: CoffeeIcon, title: 'Specialty Coffee', desc: 'Dari biji pilihan, diseduh dengan teknik yang tepat untuk setiap cangkir.' },
            { Icon: UsersIcon, title: 'Ruang Sosial', desc: 'Tempat nongkrong, diskusi, dan bekerja dalam suasana yang nyaman.' },
            { Icon: QrIcon, title: 'Order Mudah', desc: 'Scan QR di meja, pesan dari ponsel, pesanan langsung masuk ke dapur.' },
          ].map(({ Icon, title, desc }) => (
            <Section key={title} className="bg-h-card border border-h-border rounded-2xl p-7 hover:border-white/15 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-h-red/10 border border-h-red/20 flex items-center justify-center text-h-cream mb-5">
                <Icon className="w-5 h-5" />
              </div>
              <div className="font-bold text-white text-base mb-2">{title}</div>
              <div className="text-h-muted text-sm leading-relaxed">{desc}</div>
            </Section>
          ))}
        </div>
      </section>

      {/* ── Lokasi ── */}
      <section className="py-20 px-5">
        <Section className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-h-cream text-[0.55rem] tracking-[4px] uppercase font-semibold mb-3">Lokasi</div>
            <h2 className="font-sans font-black text-white text-3xl uppercase tracking-wider mb-2">Mampir Yuk</h2>
            <p className="text-h-muted text-sm">{LOC.address}</p>
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            {/* Map embed */}
            <a href={mapsView} target="_blank" rel="noreferrer"
              className="lg:col-span-3 rounded-2xl overflow-hidden border border-h-border h-[340px] relative block group">
              {/* Fallback bg di belakang iframe — tampil kalau map belum/ tidak load */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-h-card text-center px-6 z-0">
                <div className="w-12 h-12 rounded-full bg-h-red/10 border border-h-red/25 flex items-center justify-center text-h-cream mb-4">
                  <MapPinIcon className="w-6 h-6" />
                </div>
                <div className="text-white font-bold text-sm">{LOC.label}</div>
                <div className="text-h-muted text-xs mt-1">{LOC.address}</div>
                <div className="flex items-center gap-1.5 text-h-cream text-xs font-bold mt-3 uppercase tracking-wider">
                  Buka peta <ArrowIcon className="w-3.5 h-3.5" />
                </div>
              </div>
              <iframe
                src={mapsEmbed}
                title="Lokasi Hallu"
                className="w-full h-full relative z-10"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </a>

            {/* Info & actions */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="bg-h-card border border-h-border rounded-2xl p-6 flex-1 space-y-5">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-h-red/10 border border-h-red/20 flex items-center justify-center text-h-cream flex-shrink-0">
                    <MapPinIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{LOC.label}</div>
                    <div className="text-h-muted text-xs mt-0.5 leading-relaxed">{LOC.address}</div>
                  </div>
                </div>
                {storeSettings && (
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-h-red/10 border border-h-red/20 flex items-center justify-center text-h-cream flex-shrink-0">
                      <ClockIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">Jam Buka</div>
                      <div className="text-h-muted text-xs mt-0.5">{storeSettings.open_days}</div>
                      <div className="text-h-muted text-xs">{storeSettings.open_time}–{storeSettings.close_time} WIT</div>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-h-red/10 border border-h-red/20 flex items-center justify-center text-h-cream flex-shrink-0">
                    <PhoneIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">Kontak</div>
                    <a href={WA} target="_blank" rel="noreferrer" className="text-h-cream text-xs mt-0.5 hover:underline">+62 812-4540-0031</a>
                  </div>
                </div>
              </div>

              {/* Directions button */}
              <a href={mapsDirections} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 bg-h-red hover:bg-h-red-d text-white px-6 py-4 rounded-2xl font-bold text-sm uppercase tracking-[0.15em] transition-colors">
                <NavigationIcon className="w-4 h-4" /> Petunjuk Arah
              </a>
              <a href={mapsView} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 border border-h-border hover:border-white/30 text-white/70 hover:text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-[0.12em] transition-colors">
                Buka di Google Maps <ArrowIcon className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </Section>
      </section>

      {/* ── Follow Kami ── */}
      <section className="py-16 px-5">
        <Section className="max-w-3xl mx-auto text-center">
          <div className="text-h-cream text-[0.55rem] tracking-[4px] uppercase font-semibold mb-3">Follow Kami</div>
          <h2 className="font-sans font-black text-white text-2xl uppercase tracking-wider mb-2">Jangan ketinggalan</h2>
          <p className="text-h-muted text-sm mb-8 leading-relaxed">
            Menu baru, event, dan keseruan kafe — kami posting tiap hari.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Instagram */}
            <a href={IG} target="_blank" rel="noreferrer"
              className="group relative overflow-hidden rounded-2xl p-6 border border-h-border hover:border-pink-500/60 transition-all">
              <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' }} />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
                  <InstagramIcon className="w-7 h-7" />
                </div>
                <div className="text-left flex-1">
                  <div className="text-[10px] uppercase tracking-widest text-white/70 font-bold">Instagram</div>
                  <div className="font-black text-white text-base">{IG_HANDLE}</div>
                </div>
                <ArrowIcon className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </a>

            {/* TikTok */}
            <a href={TIKTOK} target="_blank" rel="noreferrer"
              className="group relative overflow-hidden rounded-2xl p-6 border border-h-border hover:border-white/60 transition-all bg-h-card">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 group-hover:opacity-40 transition-opacity"
                style={{ background: 'radial-gradient(circle, #25F4EE 0%, transparent 60%)' }} />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-20 group-hover:opacity-40 transition-opacity"
                style={{ background: 'radial-gradient(circle, #FE2C55 0%, transparent 60%)' }} />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center text-white">
                  <TikTokIcon className="w-7 h-7" />
                </div>
                <div className="text-left flex-1">
                  <div className="text-[10px] uppercase tracking-widest text-white/70 font-bold">TikTok</div>
                  <div className="font-black text-white text-base">{IG_HANDLE}</div>
                </div>
                <ArrowIcon className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </a>
          </div>
        </Section>
      </section>

      {/* ── CTA / Kontak ── */}
      <section className="py-20 px-5">
        <Section className="max-w-lg mx-auto text-center">
          <div className="relative rounded-3xl overflow-hidden border border-h-border p-10">
            {/* bg glow */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 50% 120%, rgba(124,21,21,0.4) 0%, transparent 65%)' }} />
            <div className="relative z-10">
              <div className="font-serif text-5xl mb-3" style={{ color: '#D4B896', fontFamily: 'var(--font-playfair)' }}>هالو</div>
              <h3 className="font-sans font-black text-white text-xl uppercase tracking-wider mb-2">Ada yang bisa kami bantu?</h3>
              <p className="text-h-muted text-sm mb-8 leading-relaxed">
                Reservasi tempat, pertanyaan menu, atau sekadar menyapa —<br />kami siap membantu lewat WhatsApp.
              </p>
              <a href={WA} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-3 bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-full font-bold text-sm uppercase tracking-[0.15em] transition-colors">
                <WhatsAppIcon className="w-5 h-5" />
                Chat WhatsApp
              </a>
              <div className="mt-6 text-h-muted text-xs">+62 812-4540-0031</div>
            </div>
          </div>
        </Section>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-h-border py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <div className="font-sans font-black text-white tracking-widest text-sm uppercase">HALLU</div>
            <div className="text-h-muted text-xs mt-0.5">Coffee &amp; Sociality · Ternate, Indonesia</div>
            {storeSettings && (
              <div className="text-h-muted text-xs mt-1">
                🕐 {storeSettings.open_days} · {storeSettings.open_time}–{storeSettings.close_time}
              </div>
            )}
          </div>
          <div className="flex flex-col sm:items-end gap-3">
            <div className="flex items-center gap-3">
              <a href={IG} target="_blank" rel="noreferrer" aria-label="Instagram"
                className="w-8 h-8 flex items-center justify-center rounded-full border border-h-border hover:border-pink-500/60 hover:text-pink-400 text-h-muted transition-colors">
                <InstagramIcon className="w-3.5 h-3.5" />
              </a>
              <a href={TIKTOK} target="_blank" rel="noreferrer" aria-label="TikTok"
                className="w-8 h-8 flex items-center justify-center rounded-full border border-h-border hover:border-white/60 hover:text-white text-h-muted transition-colors">
                <TikTokIcon className="w-3.5 h-3.5" />
              </a>
              <a href={WA} target="_blank" rel="noreferrer" aria-label="WhatsApp"
                className="w-8 h-8 flex items-center justify-center rounded-full border border-h-border hover:border-green-500/60 hover:text-green-400 text-h-muted transition-colors">
                <WhatsAppIcon className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="flex items-center gap-5">
              <a href="/menu?table=1" className="text-h-muted hover:text-white text-xs transition-colors">Menu</a>
              <a href="/kasir" className="text-h-muted hover:text-white text-xs transition-colors">Kasir</a>
              <a href="/admin" className="text-h-muted hover:text-white text-xs transition-colors">Admin</a>
            </div>
          </div>
        </div>
        <div className="text-center mt-8 text-white/10 text-[10px] tracking-widest uppercase">
          © 2025 Hallu · All rights reserved
        </div>
      </footer>

    </div>
  )
}
