'use client'
import React, { useEffect, useRef, useState } from 'react'
import type { MenuItem } from '@/types'
import { formatRp } from '@/lib/format'
import { CAT_ICONS, generatePlaceholder, CAT_ATM, DEFAULT_ATM, AtmosphericParticles } from '@/components/menu/atmosphere'

// Type declaration for <model-viewer> web component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src: string
        alt?: string
        ar?: boolean
        'auto-rotate'?: boolean
        'camera-controls'?: boolean
        'shadow-intensity'?: string | number
        'environment-image'?: string
        exposure?: string | number
        'rotation-per-second'?: string
        'auto-rotate-delay'?: string | number
        'ar-modes'?: string
        poster?: string
      }, HTMLElement>
    }
  }
}

// ── Product Showcase Modal — CINEMATIC ─────────────────────
export function ShowcaseModal({ item, qty, onAdd, onRemove, onClose }: {
  item: MenuItem; qty: number
  onAdd: () => void; onRemove: () => void; onClose: () => void
}) {
  const atm = CAT_ATM[item.category] || DEFAULT_ATM
  const imgSrc = item.image_url || generatePlaceholder(item)
  const [imgTilt, setImgTilt] = useState({ x: 0, y: 0 })
  const [lensFlare, setLensFlare] = useState({ x: 50, y: 50, active: false })
  const [gyroPermission, setGyroPermission] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown')
  const imgWrapRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Gyroscope tilt on mobile
  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setGyroPermission('unsupported'); return
    }
    // iOS needs permission
    const DOEvent = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    const needsPermission = typeof DOEvent.requestPermission === 'function'
    let cleanup = () => {}

    const attach = () => {
      const handler = (e: DeviceOrientationEvent) => {
        const gamma = e.gamma || 0  // left-right tilt (-90 to 90)
        const beta  = e.beta  || 0  // front-back tilt (-180 to 180)
        const x = Math.max(-18, Math.min(18, gamma / 4))
        const y = Math.max(-18, Math.min(18, (beta - 30) / 4))
        setImgTilt({ x, y: -y })
      }
      window.addEventListener('deviceorientation', handler)
      cleanup = () => window.removeEventListener('deviceorientation', handler)
      setGyroPermission('granted')
    }

    if (needsPermission) {
      // user needs to tap to grant - request on first touch
      const onFirstTouch = async () => {
        try {
          const res = await DOEvent.requestPermission!()
          if (res === 'granted') attach()
          else setGyroPermission('denied')
        } catch { setGyroPermission('denied') }
        window.removeEventListener('touchstart', onFirstTouch)
      }
      window.addEventListener('touchstart', onFirstTouch, { once: true })
      cleanup = () => window.removeEventListener('touchstart', onFirstTouch)
    } else {
      attach()
    }

    return () => cleanup()
  }, [])

  const handleImgMove = (e: React.MouseEvent | React.TouchEvent) => {
    const wrap = imgWrapRef.current; if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const x = (clientX - rect.left) / rect.width  - 0.5
    const y = (clientY - rect.top)  / rect.height - 0.5
    setImgTilt({ x: x * 22, y: -y * 22 })
  }
  const resetTilt = () => {
    // hanya reset kalau bukan dari gyro
    if (gyroPermission !== 'granted') setImgTilt({ x: 0, y: 0 })
  }

  const handleOverlayMove = (e: React.MouseEvent) => {
    const overlay = overlayRef.current; if (!overlay) return
    const rect = overlay.getBoundingClientRect()
    setLensFlare({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
      active: true,
    })
  }

  return (
    <div ref={overlayRef}
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden"
      onClick={onClose}
      onMouseMove={handleOverlayMove}
      onMouseLeave={() => setLensFlare(f => ({ ...f, active: false }))}>

      {/* Atmospheric background */}
      <div className="absolute inset-0" style={{ background: atm.bg }} />

      {/* Lens flare following cursor */}
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: lensFlare.active ? 0.7 : 0,
          background: `radial-gradient(circle 250px at ${lensFlare.x}% ${lensFlare.y}%, ${atm.glow} 0%, transparent 60%)`,
          mixBlendMode: 'screen',
        }} />

      {/* Cinematic vignette pulsing */}
      <div className="absolute inset-0 pointer-events-none cinematic-vignette" />

      {/* Letterbox top */}
      <div className="letterbox-top absolute top-0 left-0 right-0 h-12 sm:h-16 bg-black z-30 pointer-events-none" />
      {/* Letterbox bottom */}
      <div className="letterbox-bottom absolute bottom-0 left-0 right-0 h-12 sm:h-16 bg-black z-30 pointer-events-none"
        style={{ display: 'none' }} />

      {/* Atmospheric particles per category */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <AtmosphericParticles type={atm.particle} accent={atm.accent} />
      </div>

      {/* Ambient center glow */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-96 h-96 rounded-full blur-3xl opacity-40 animate-hero-glow"
          style={{ background: atm.glow }} />
      </div>

      {/* Close button */}
      <button onClick={onClose}
        className="absolute top-16 sm:top-20 left-4 z-40 flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth={2}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Menu
      </button>

      {/* Category badge */}
      <div className="absolute top-16 sm:top-20 right-4 z-40">
        <span className="text-[10px] font-black uppercase tracking-[3px] px-3 py-1.5 rounded-full border backdrop-blur-sm"
          style={{ color: atm.accent, borderColor: atm.ring, background: 'rgba(0,0,0,0.5)' }}>
          {CAT_ICONS[item.category]} {item.category}
        </span>
      </div>

      {/* 3D Product — REAL GLB MODEL atau fallback Multi-layer parallax */}
      <div className="flex-1 flex items-center justify-center relative z-10 pt-20 pb-2"
        onClick={e => e.stopPropagation()}>

        {item.model_3d_url ? (
          // REAL 3D MODEL — model-viewer
          <div className="relative w-full max-w-[420px] h-[60vh] sm:h-[420px] animate-dolly-in">
            <model-viewer
              src={item.model_3d_url}
              alt={item.name}
              ar
              ar-modes="webxr scene-viewer quick-look"
              camera-controls
              auto-rotate
              auto-rotate-delay={1500}
              rotation-per-second="20deg"
              shadow-intensity="1.2"
              exposure="1.1"
              poster={imgSrc}
              style={{
                width: '100%', height: '100%',
                background: 'transparent',
                filter: `drop-shadow(0 0 40px ${atm.glow})`,
              }}
            />
            {/* AR badge */}
            <div className="absolute bottom-2 right-2 text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded-full"
              style={{ color: atm.accent, background: 'rgba(0,0,0,0.5)', border: `1px solid ${atm.ring}` }}>
              📱 Tap AR di pojok untuk lihat di mejamu
            </div>
          </div>
        ) : (
          // FALLBACK — Multi-layer parallax 2D image
        <div ref={imgWrapRef}
          onMouseMove={handleImgMove} onMouseLeave={resetTilt}
          onTouchMove={handleImgMove} onTouchEnd={resetTilt}
          className="animate-dolly-in"
          style={{ perspective: '1200px', cursor: 'grab', width: '17rem', height: '17rem' }}>
          <div className="relative w-full h-full" style={{
            transform: `rotateY(${imgTilt.x}deg) rotateX(${imgTilt.y}deg)`,
            transition: imgTilt.x === 0 ? 'transform 0.8s cubic-bezier(0.22,1,0.36,1)' : 'transform 0.08s ease-out',
            transformStyle: 'preserve-3d',
          }}>
            {/* LAYER 1 — Background ambient (deep, blurred) */}
            <img src={imgSrc} alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover rounded-3xl"
              style={{
                filter: 'blur(28px) brightness(0.55) saturate(1.4)',
                transform: `translateZ(-80px) scale(1.2) rotateY(${imgTilt.x * 0.4}deg) rotateX(${imgTilt.y * 0.4}deg)`,
                opacity: 0.55,
              }} />

            {/* LAYER 2 — Main product image (mid-depth) */}
            <img src={imgSrc} alt={item.name}
              className="absolute inset-0 w-full h-full object-cover rounded-3xl"
              style={{
                transform: `translateZ(0px) rotateY(${imgTilt.x * -0.2}deg) rotateX(${imgTilt.y * -0.2}deg)`,
                filter: `drop-shadow(0 0 40px ${atm.glow}) drop-shadow(0 25px 50px rgba(0,0,0,0.8))`,
                animation: 'float-zoom 8s ease-in-out infinite',
              }} />

            {/* LAYER 3 — Glass sheen (foreground, opposite tilt) */}
            <div className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 35%, transparent 60%)',
                transform: `translateZ(40px) rotateY(${imgTilt.x * 1.4}deg) rotateX(${imgTilt.y * 1.4}deg)`,
                mixBlendMode: 'screen',
              }} />

            {/* LAYER 4 — Specular highlight (top corner, follows tilt) */}
            <div className="absolute rounded-full pointer-events-none"
              style={{
                top: '12%', left: '18%',
                width: '40%', height: '20%',
                background: 'radial-gradient(ellipse, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.1) 50%, transparent 80%)',
                filter: 'blur(8px)',
                transform: `translateZ(50px) rotateY(${imgTilt.x * 1.8}deg) rotateX(${imgTilt.y * 1.8}deg)`,
                mixBlendMode: 'screen',
                opacity: 0.65,
              }} />

            {/* Floor reflection */}
            <div className="absolute top-full left-2 right-2 h-20 pointer-events-none rounded-b-3xl overflow-hidden"
              style={{ transform: `translateZ(-20px) rotateX(${imgTilt.y * 0.3}deg)` }}>
              <img src={imgSrc} alt="" aria-hidden
                className="w-full h-full object-cover"
                style={{
                  transform: 'scaleY(-1)',
                  maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 80%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 80%)',
                  filter: 'blur(8px) saturate(1.3)',
                  opacity: 0.4,
                }} />
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Tilt hint */}
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 text-white/30 text-[10px] uppercase tracking-[3px] font-bold pointer-events-none z-20 animate-info-slide-up">
        {item.model_3d_url
          ? '🖱 Drag untuk putar · scroll untuk zoom'
          : gyroPermission === 'granted' ? '↕ Miringkan HP' : '↔ Drag untuk putar'}
      </div>

      {/* Info panel — cinematic reveal */}
      <div className="relative z-30 rounded-t-3xl px-6 pt-6 pb-10 animate-info-slide-up"
        onClick={e => e.stopPropagation()}
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(28px)', borderTop: `1px solid ${atm.ring}` }}>
        <div className="text-xs font-black uppercase tracking-[4px] mb-1.5 animate-title-reveal" style={{ color: atm.accent }}>
          {formatRp(item.price)}
        </div>
        <h2 className="font-sans font-black text-white text-2xl sm:text-3xl leading-tight mb-2 animate-title-reveal" style={{ animationDelay: '0.65s' }}>
          {item.name}
        </h2>
        {item.description && (
          <p className="text-white/55 text-sm leading-relaxed mb-5 italic">"{item.description}"</p>
        )}
        <div className="flex items-center justify-between gap-4">
          <div>
            {qty > 0 && (
              <div className="text-xs text-white/40 font-bold">{qty}× di keranjang · {formatRp(item.price * qty)}</div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {qty > 0 && (
              <>
                <button onClick={onRemove}
                  className="w-11 h-11 rounded-full border flex items-center justify-center text-white font-bold text-xl leading-none transition-all active:scale-90 hover:scale-105"
                  style={{ borderColor: atm.ring, background: 'rgba(0,0,0,0.4)' }}>−</button>
                <span className="font-black text-white text-lg w-5 text-center">{qty}</span>
              </>
            )}
            <button onClick={onAdd}
              className="h-11 px-6 rounded-full font-black text-sm uppercase tracking-wider text-white transition-all active:scale-90 hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${atm.accent} 0%, ${atm.ring} 100%)`,
                boxShadow: `0 8px 24px ${atm.glow}`,
              }}>
              {qty === 0 ? '+ Tambah' : '+'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
