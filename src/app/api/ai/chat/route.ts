import { NextRequest, NextResponse } from 'next/server'
import { aiComplete, aiEnabled, aiErrorDetails } from '@/lib/ai'

export const runtime = 'nodejs'

type ChatInput = {
  messages: { role: 'user' | 'assistant'; content: string }[]
  menu: { name: string; category: string; price: number; description: string | null }[]
}

const SYSTEM_PROMPT = (menuStr: string) => `Kamu adalah AI barista Hallu Coffee & Sociality (kafe di Ternate). Persona kamu: ramah, hangat, sedikit playful, pakai bahasa Indonesia santai. Bisa pakai sapaan "Kak".

MENU SAAT INI:
${menuStr}

ATURAN:
- Selalu rekomendasikan dari MENU YANG ADA di atas. JANGAN karang menu yang tidak ada.
- Jawaban SINGKAT (max 3-4 kalimat). To the point.
- Kalau customer tanya hal di luar menu/order (cuaca, politik, dsb) — alihkan balik ke menu dengan halus.
- Untuk rekomendasi: sebut nama menu + 1 alasan kenapa cocok.
- Boleh pakai 1-2 emoji untuk vibe friendly, jangan berlebihan.
- Kalau tidak yakin / tidak ada info — jujur bilang "saya cek dulu ya" atau arahkan tanya ke kasir.

Contoh gaya:
- "Lagi ingin yang dingin & manis? Aku rekomen *Es Kopi Susu* — kopi creamy + gula aren bikin nagih ☕"
- "Buat sore santai cocok banget *Cappuccino* + *Croissant*. Pas banget di lidah!"
`

export async function POST(req: NextRequest) {
  if (!aiEnabled()) {
    return NextResponse.json({ error: aiErrorDetails() }, { status: 503 })
  }
  try {
    const data: ChatInput = await req.json()
    const menuStr = data.menu.map(m =>
      `- ${m.name} (${m.category}, Rp ${m.price.toLocaleString('id-ID')})${m.description ? ` — ${m.description}` : ''}`
    ).join('\n')

    const reply = await aiComplete({
      system: SYSTEM_PROMPT(menuStr),
      messages: data.messages.slice(-10), // limit conversation history
      maxTokens: 400,
    })
    return NextResponse.json({ reply })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
