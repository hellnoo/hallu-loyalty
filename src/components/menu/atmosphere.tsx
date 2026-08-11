import React from 'react'
import type { MenuItem } from '@/types'
import { BRAND } from '@/lib/brand'

export const CAT_ICONS: Record<string, string> = {
  'Kopi': '☕', 'Non-Kopi': '🥤', 'Makanan': '🍽️', 'Lainnya': '✨',
}

export function generatePlaceholder(item: MenuItem): string {
  const icon = CAT_ICONS[item.category] || '☕'
  const name = item.name.length > 18 ? item.name.slice(0, 17) + '…' : item.name
  // escape karakter XML agar SVG valid
  const safeName = name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="var(--brand-primary-hex)"/>
        <stop offset="100%" stop-color="#2D0808"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="45%" r="45%">
        <stop offset="0%" stop-color="#A02020" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
    </defs>
    <rect width="400" height="200" fill="url(#g)"/>
    <rect width="400" height="200" fill="url(#glow)"/>
    <text x="200" y="92" text-anchor="middle" font-size="54" opacity="0.9">${icon}</text>
    <text x="200" y="138" text-anchor="middle" font-family="system-ui,sans-serif" font-size="17" font-weight="700" fill="rgba(255,255,255,0.88)">${safeName}</text>
    <text x="200" y="178" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="rgba(212,184,150,0.45)" letter-spacing="5">${BRAND.name}</text>
  </svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

const IMG_ANIMATIONS = [
  'animate-kenburns',
  'animate-float-zoom',
  'animate-drift',
  'animate-tilt3d',
]
export function pickAnim(id: string) {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return IMG_ANIMATIONS[hash % IMG_ANIMATIONS.length]
}
export function leakDelay(id: string) {
  return -((id.charCodeAt(0) % 10) * 1.1)
}

// ── Per-category atmosphere ────────────────────────────────
export type ParticleType = 'steam' | 'ice' | 'haze' | 'sparkle'
export const CAT_ATM: Record<string, { bg: string; glow: string; accent: string; ring: string; particle: ParticleType }> = {
  'Kopi':     { bg: 'radial-gradient(ellipse at 50% 25%, #3D1A00 0%, #1C0900 45%, #080300 100%)', glow: 'rgba(212,129,58,0.55)', accent: '#D4813A', ring: '#7C3A10', particle: 'steam'   },
  'Non-Kopi': { bg: 'radial-gradient(ellipse at 50% 25%, #003D3A 0%, #001A18 45%, #000806 100%)', glow: 'rgba(52,211,153,0.5)',  accent: '#34D399', ring: '#065F46', particle: 'ice'     },
  'Makanan':  { bg: 'radial-gradient(ellipse at 50% 25%, #3D2500 0%, #1A1000 45%, #080500 100%)', glow: 'rgba(251,146,60,0.5)',  accent: '#FB923C', ring: '#7C3100', particle: 'haze'    },
  'Lainnya':  { bg: 'radial-gradient(ellipse at 50% 25%, #2A003D 0%, #12001A 45%, #060008 100%)', glow: 'rgba(167,139,250,0.5)', accent: '#A78BFA', ring: '#4C1D95', particle: 'sparkle' },
}
export const DEFAULT_ATM = CAT_ATM['Kopi']

// Particle generators — deterministic per type
const STEAM_PARTICLES = Array.from({ length: 8 }, (_, i) => ({
  left: `${20 + (i * 47 + 11) % 60}%`,
  size: ((i * 13) % 25) + 30,
  delay: `${-((i * 0.65) % 5)}s`,
  dur: `${4 + (i * 0.4) % 3}s`,
  drift: `${((i * 7) % 30) - 15}px`,
}))
const ICE_PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37 + 13) % 90 + 5}%`,
  top:  `${(i * 23 + 7)  % 80 + 10}%`,
  delay: `${-((i * 0.4) % 4)}s`,
  dur: `${2.5 + (i * 0.3) % 2.5}s`,
}))
const HAZE_PARTICLES = Array.from({ length: 6 }, (_, i) => ({
  left: `${10 + (i * 53 + 21) % 75}%`,
  top:  `${20 + (i * 43 + 11) % 60}%`,
  size: ((i * 17) % 40) + 60,
  delay: `${-((i * 1.1) % 6)}s`,
  dur: `${6 + (i * 0.7) % 4}s`,
}))
const SPARKLE_PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 31 + 7) % 92 + 4}%`,
  delay: `${-((i * 0.55) % 7)}s`,
  dur: `${5 + (i * 0.4) % 3}s`,
}))

// ── Atmospheric Particles (per category) ───────────────────
export function AtmosphericParticles({ type, accent }: { type: ParticleType; accent: string }) {
  if (type === 'steam') return (
    <>{STEAM_PARTICLES.map((p, i) => (
      <div key={i} className="particle-steam"
        style={{
          left: p.left, bottom: '15%',
          width: p.size, height: p.size,
          ['--delay' as string]: p.delay,
          ['--dur' as string]: p.dur,
          ['--drift' as string]: p.drift,
        } as React.CSSProperties} />
    ))}</>
  )
  if (type === 'ice') return (
    <>{ICE_PARTICLES.map((p, i) => (
      <div key={i} className="particle-ice"
        style={{
          left: p.left, top: p.top,
          background: accent,
          boxShadow: `0 0 8px 2px ${accent}, 0 0 16px 4px ${accent}40`,
          ['--delay' as string]: p.delay,
          ['--dur' as string]: p.dur,
        } as React.CSSProperties} />
    ))}</>
  )
  if (type === 'haze') return (
    <>{HAZE_PARTICLES.map((p, i) => (
      <div key={i} className="particle-haze"
        style={{
          left: p.left, top: p.top,
          width: p.size, height: p.size,
          ['--delay' as string]: p.delay,
          ['--dur' as string]: p.dur,
        } as React.CSSProperties} />
    ))}</>
  )
  // sparkle
  return (
    <>{SPARKLE_PARTICLES.map((p, i) => (
      <div key={i} className="particle-sparkle"
        style={{
          left: p.left, top: '-5%',
          boxShadow: `0 0 6px 1px ${accent}, 0 0 12px 3px ${accent}80`,
          ['--delay' as string]: p.delay,
          ['--dur' as string]: p.dur,
        } as React.CSSProperties} />
    ))}</>
  )
}
