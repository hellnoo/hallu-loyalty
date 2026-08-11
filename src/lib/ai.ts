import Anthropic from '@anthropic-ai/sdk'

export type ChatMsg = { role: 'user' | 'assistant'; content: string }

const ANTHROPIC_KEY = (process.env.ANTHROPIC_API_KEY || '').trim()
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'

// Kunci AI bisa datang dari DATABASE (diatur di Admin Pusat) atau env.
// DB menang supaya pemilik tidak perlu buka Vercel.
let FREE_KEY = (process.env.AI_API_KEY || '').trim()
export function setAiKey(key: string | null | undefined) {
  const k = (key || '').trim()
  if (k) FREE_KEY = k
}

// Deteksi provider gratis dari format key (semua OpenAI-compatible):
// Groq (gsk_...), Google Gemini (AIza...), OpenRouter (sk-or-...)
function freeProvider() {
  if (!FREE_KEY) return null
  const base = (process.env.AI_BASE_URL || '').trim()
  const model = (process.env.AI_MODEL || '').trim()
  if (base) return { base, model: model || 'llama-3.3-70b-versatile', name: 'custom' }
  if (FREE_KEY.startsWith('gsk_'))
    return { base: 'https://api.groq.com/openai/v1', model: model || 'llama-3.3-70b-versatile', name: 'Groq' }
  if (FREE_KEY.startsWith('AIza'))
    return { base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: model || 'gemini-2.0-flash', name: 'Gemini' }
  if (FREE_KEY.startsWith('sk-or-'))
    return { base: 'https://openrouter.ai/api/v1', model: model || 'meta-llama/llama-3.3-70b-instruct:free', name: 'OpenRouter' }
  return null
}

export function aiEnabled() {
  return ANTHROPIC_KEY.startsWith('sk-ant-') || !!freeProvider()
}

export function aiErrorDetails(): string {
  if (ANTHROPIC_KEY && !ANTHROPIC_KEY.startsWith('sk-ant-'))
    return 'ANTHROPIC_API_KEY format salah — harus mulai dengan "sk-ant-".'
  if (FREE_KEY && !freeProvider())
    return 'AI_API_KEY tidak dikenali. Pakai key Groq (gsk_...), Gemini (AIza...), OpenRouter (sk-or-...), atau set AI_BASE_URL + AI_MODEL manual.'
  return 'AI belum aktif. Buka Admin → Pengaturan → "Kunci AI", tempel kunci gratis dari Groq (gsk_...) atau Google Gemini (AIza...), lalu Simpan.'
}

export async function aiComplete(opts: {
  prompt?: string
  system?: string
  messages?: ChatMsg[]
  maxTokens?: number
}): Promise<string> {
  const messages: ChatMsg[] = opts.messages ?? [{ role: 'user', content: opts.prompt || '' }]
  const maxTokens = opts.maxTokens ?? 600

  // 1) Anthropic diprioritaskan kalau key-nya ada (kualitas terbaik)
  if (ANTHROPIC_KEY.startsWith('sk-ant-')) {
    const client = new Anthropic({ apiKey: ANTHROPIC_KEY })
    const msg = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      ...(opts.system ? { system: opts.system } : {}),
      messages,
    })
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('\n').trim()
  }

  // 2) Provider gratis — endpoint OpenAI-compatible
  const p = freeProvider()
  if (!p) throw new Error(aiErrorDetails())
  const res = await fetch(`${p.base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${FREE_KEY}` },
    body: JSON.stringify({
      model: p.model,
      max_tokens: maxTokens,
      messages: [
        ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
        ...messages,
      ],
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${p.name} error ${res.status}: ${json?.error?.message || 'request gagal'}`)
  const text = json?.choices?.[0]?.message?.content
  if (!text) throw new Error(`${p.name}: respons kosong`)
  return String(text).trim()
}
