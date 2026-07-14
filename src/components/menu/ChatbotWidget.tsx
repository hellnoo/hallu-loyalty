'use client'
import { useEffect, useRef, useState } from 'react'
import type { MenuItem } from '@/types'
import { BRAND_NICE } from '@/lib/brand'

// ── AI Chatbot Widget ──────────────────────────────────────
export function ChatbotWidget({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: `Halo Kak! ☕ Aku barista AI ${BRAND_NICE}. Mau rekomendasi menu? Tanya aja, atau pilih cepat di bawah 👇` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text: string) => {
    const userText = text.trim(); if (!userText || loading) return
    setInput('')
    const newMessages = [...messages, { role: 'user' as const, content: userText }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          menu: items.map(i => ({ name: i.name, category: i.category, price: i.price, description: i.description }))
        })
      })
      const json = await res.json()
      const reply = json.reply || json.error || 'Maaf, aku error nih. Coba lagi ya.'
      setMessages(m => [...m, { role: 'assistant', content: reply }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Koneksi error. Coba lagi ya Kak 🙏' }])
    } finally {
      setLoading(false)
    }
  }

  const quickPrompts = [
    'Rekomen yang manis & dingin',
    'Buat sore santai',
    'Kopi yang ga pahit',
    'Cocok buat ngantuk',
  ]

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-h-red to-h-red-d flex items-center justify-center shadow-2xl active:scale-90 transition-all"
          style={{ boxShadow: '0 8px 30px rgba(230,51,41,0.45)' }}
          aria-label="Chat barista">
          <span className="text-2xl">💬</span>
          <span className="absolute -top-1 -right-1 bg-white text-h-red text-[8px] font-black px-1.5 py-0.5 rounded-full">AI</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center pointer-events-none">
          <div className="absolute inset-0 bg-black/60 pointer-events-auto" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-[440px] bg-h-dark border border-h-border sm:rounded-2xl rounded-t-3xl flex flex-col pointer-events-auto"
            style={{ height: '80vh', maxHeight: '600px' }}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-h-border flex items-center justify-between bg-gradient-to-r from-h-red/20 to-transparent sm:rounded-t-2xl rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-h-red flex items-center justify-center text-lg">🤖</div>
                <div>
                  <div className="font-black text-white text-sm">Barista AI</div>
                  <div className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Online</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-h-muted hover:text-white text-2xl leading-none">×</button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-h-red text-white rounded-br-md'
                      : 'bg-h-card border border-h-border text-white/90 rounded-bl-md'
                  }`}>
                    {m.content.split('\n').map((line, j) => (
                      <div key={j}>{line.replace(/\*([^*]+)\*/g, '$1')}</div>
                    ))}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-h-card border border-h-border rounded-2xl rounded-bl-md px-4 py-2.5 flex gap-1">
                    {[0, 0.15, 0.3].map(d => (
                      <span key={d} className="w-1.5 h-1.5 bg-h-muted rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick prompts */}
            {messages.length <= 2 && !loading && (
              <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
                {quickPrompts.map(q => (
                  <button key={q} onClick={() => send(q)}
                    className="flex-shrink-0 text-xs text-h-cream border border-h-red/30 hover:bg-h-red/10 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap font-bold">
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form onSubmit={e => { e.preventDefault(); send(input) }}
              className="border-t border-h-border p-3 flex gap-2">
              <input
                value={input} onChange={e => setInput(e.target.value)}
                placeholder="Tanya barista..."
                disabled={loading}
                className="flex-1 bg-h-card border border-h-border rounded-full px-4 py-2.5 text-sm text-white placeholder-h-muted focus:outline-none focus:border-h-red transition-colors" />
              <button type="submit" disabled={loading || !input.trim()}
                className="w-11 h-11 rounded-full bg-h-red hover:bg-h-red-d disabled:opacity-40 flex items-center justify-center text-white transition-colors flex-shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
