import { NextRequest, NextResponse } from 'next/server'
import { aiComplete, aiEnabled, aiErrorDetails } from '@/lib/ai'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!aiEnabled()) {
    return NextResponse.json({ error: aiErrorDetails() }, { status: 503 })
  }
  try {
    const { name, category, hppComponents } = await req.json()
    if (!name) return NextResponse.json({ error: 'Nama menu wajib' }, { status: 400 })

    const compStr = Array.isArray(hppComponents) && hppComponents.length > 0
      ? `Bahan/komponen yang digunakan: ${hppComponents.map((c: { nama: string }) => c.nama).filter(Boolean).join(', ')}`
      : ''

    const prompt = `Buatkan deskripsi menu kafe yang MENGGIURKAN untuk:
Nama: ${name}
Kategori: ${category || 'menu'}
${compStr}

ATURAN:
- Max 12-15 kata, 1 kalimat
- Bahasa Indonesia, gaya warm & friendly
- Highlight rasa/sensasi (manis, smoky, creamy, dll) atau momen yang cocok
- JANGAN sebut harga
- JANGAN pakai emoji
- Output langsung deskripsinya saja, tanpa quotes, tanpa preamble.

Contoh: "Espresso kuat berpadu susu segar, creamy dan harum, cocok teman pagi yang santai."`

    const description = await aiComplete({ prompt, maxTokens: 120 })
    return NextResponse.json({ description: description.replace(/^["']|["']$/g, '') })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
