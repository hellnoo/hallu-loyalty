import { NextRequest, NextResponse } from 'next/server'
import { aiComplete, aiEnabled, aiErrorDetails } from '@/lib/ai'

export const runtime = 'nodejs'

type InsightsInput = {
  items: {
    name: string
    category: string
    price: number
    hpp: number
    qtySold30d: number
    revenue30d: number
    margin: number | null
  }[]
}

export async function POST(req: NextRequest) {
  if (!aiEnabled()) {
    return NextResponse.json({ error: aiErrorDetails() }, { status: 503 })
  }
  try {
    const data: InsightsInput = await req.json()
    const dataStr = data.items.map(i =>
      `${i.name} | ${i.category} | Harga Rp${i.price} | HPP Rp${i.hpp} | Margin ${i.margin ?? 'N/A'}% | Terjual ${i.qtySold30d}x | Revenue Rp${i.revenue30d}`
    ).join('\n')

    const prompt = `Kamu adalah konsultan menu kafe yang berpengalaman. Analisis data menu Hallu Coffee & Sociality berikut (30 hari terakhir):

${dataStr}

Buat MENU ENGINEERING ANALYSIS dengan klasifikasi berikut (BCG matrix untuk menu):
- ⭐ *Star* (margin tinggi + laku) → pertahankan, tonjolkan
- 🐎 *Plowhorse* (margin rendah + laku) → naikkan harga / efisienkan HPP
- 🧩 *Puzzle* (margin tinggi + lambat laku) → promosikan / bundling
- 🐕 *Dog* (margin rendah + lambat laku) → pertimbangkan hapus / ganti

OUTPUT format Markdown WhatsApp (*tebal*):
1. Mulai dengan judul: 🧠 *Menu Engineering Hallu*
2. Klasifikasi tiap item (max 3 item per kategori, item paling penting)
3. Beri 3-5 REKOMENDASI ACTION konkret (item spesifik + apa yang harus dilakukan)
4. Total max 400 kata, bahasa Indonesia santai friendly
5. JANGAN pakai data palsu

Output langsung analisisnya, tanpa preamble.`

    const insights = await aiComplete({ prompt, maxTokens: 1000 })
    return NextResponse.json({ insights })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
