'use client'
import React, { useEffect, useRef, useState } from 'react'
import type { MenuItem } from '@/types'
import { formatRp } from '@/lib/format'
import { generatePlaceholder, pickAnim, leakDelay, CAT_ATM, DEFAULT_ATM } from '@/components/menu/atmosphere'

export function ItemCard({
  item, qty, onAdd, onRemove, index = 0, onShowcase,
}: {
  item: MenuItem; qty: number; onAdd: () => void; onRemove: () => void; index?: number; onShowcase: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [visible, setVisible] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const imgSrc = item.image_url || generatePlaceholder(item)
  const atm = CAT_ATM[item.category] || DEFAULT_ATM

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = cardRef.current?.getBoundingClientRect(); if (!rect) return
    const x = (e.clientX - rect.left) / rect.width  - 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5
    setTilt({ x: x * 8, y: -y * 8 })
  }
  const resetTilt = () => setTilt({ x: 0, y: 0 })

  // Entrance cascade — fade + slide up saat masuk viewport
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.06 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Scroll parallax — geser object-position, tidak ganggu CSS transform animation
  useEffect(() => {
    const el = cardRef.current
    const img = imgRef.current
    if (!el || !img) return
    const onScroll = () => {
      const rect = el.getBoundingClientRect()
      const progress = (window.innerHeight / 2 - rect.top - rect.height / 2) / (window.innerHeight + rect.height)
      img.style.objectPosition = `center ${50 + progress * 18}%`
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={resetTilt}
      className="bg-h-card border border-h-border rounded-2xl overflow-hidden cursor-pointer"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? `perspective(700px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg) translateY(0)`
          : 'translateY(22px)',
        transition: tilt.x !== 0
          ? 'opacity 0.5s ease, transform 0.09s ease'
          : `opacity 0.5s ease ${index * 65}ms, transform 0.55s ease ${index * 65}ms`,
        boxShadow: tilt.x !== 0 ? `0 12px 40px ${atm.glow}` : undefined,
      }}
    >
      {/* Photo — tap to open showcase */}
      <div
        onClick={onShowcase}
        className="relative h-40 overflow-hidden shine-overlay light-leak"
        style={{ '--leak-delay': `${leakDelay(item.id)}s` } as React.CSSProperties}
      >
        <img
          ref={imgRef}
          src={imgSrc}
          alt={item.name}
          className={`w-full h-full object-cover ${pickAnim(item.id)}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-h-card via-h-card/10 to-transparent" />
        {/* Category color accent line */}
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: atm.accent, opacity: 0.7 }} />
        <div className="absolute bottom-2.5 right-3 bg-black/60 backdrop-blur-sm text-h-cream font-black text-sm px-2.5 py-1 rounded-lg">
          {formatRp(item.price)}
        </div>
        {/* Showcase hint */}
        <div className="absolute top-2.5 left-3 text-white/40 text-[9px] font-bold uppercase tracking-widest">
          Tap untuk detail
        </div>
      </div>
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0" onClick={onShowcase}>
          <div className="font-semibold text-white text-[0.92rem]">{item.name}</div>
          {item.description && (
            <div className="text-h-muted text-xs mt-0.5 leading-relaxed line-clamp-2">
              {item.description}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
          {qty > 0 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); onRemove() }}
                className="w-8 h-8 rounded-full border border-h-border flex items-center justify-center text-white font-bold text-lg leading-none hover:border-white/40 transition-colors active:scale-90"
              >−</button>
              <span className="w-5 text-center font-bold text-white text-sm">{qty}</span>
            </>
          )}
          <button
            onClick={e => { e.stopPropagation(); onAdd() }}
            className="w-8 h-8 rounded-full bg-h-red hover:bg-h-red-d flex items-center justify-center text-white font-bold text-lg leading-none transition-all active:scale-90"
          >+</button>
        </div>
      </div>
    </div>
  )
}
