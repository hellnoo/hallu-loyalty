import { NextRequest, NextResponse } from 'next/server'
import { aiComplete, aiEnabled, aiErrorDetails } from '@/lib/ai'
import { BRAND, BRAND_FULL } from '@/lib/brand'

export const runtime = 'nodejs'

type RecommendInput = {
  cart: { name: string; category: string; price: number; qty: number }[]
  menu: { id: string; name: string; category: string; price: number; description: string | null }[]
  // History co-purchase counts (from done orders): mapping item name -> { otherName: count }
  coPurchase?: Record<string, Record<string, number>>
}

export async function POST(req: NextRequest) {
  if (!aiEnabled()) {
    return NextResponse.json({ error: aiErrorDetails() }, { status: 503 })
  }
  try {
    const data: RecommendInput = await req.json()
    if (!data.cart?.length) {
      return NextResponse.json({ recommendations: [], reason: 'Cart kosong' })
    }

    const cartNames = data.cart.map(c => c.name)
    const cartCategories = [...new Set(data.cart.map(c => c.category))]

    // Filter menu — exclude yang sudah di cart
    const availableMenu = data.menu.filter(m => !cartNames.includes(m.name)).slice(0, 30)

    const coPurchaseStr = data.coPurchase
      ? Object.entries(data.coPurchase)
          .filter(([k]) => cartNames.includes(k))
          .map(([k, v]) => `"${k}" sering dipesan bareng: ${Object.entries(v).slice(0, 5).map(([n, c]) => `${n}(${c}x)`).join(', ')}`)
          .join('\n')
      : ''

    const prompt = `Kamu adalah barista expert di ${BRAND_FULL} (${BRAND.city}). Customer sedang di keranjang dan kamu harus rekomendasi 2-3 ITEM TAMBAHAN yang COCOK & MENGGIURKAN.

KERANJANG SAAT INI:
${data.cart.map(c => `- ${c.name} x${c.qty} (${c.category}, Rp ${c.price.toLocaleString('id-ID')})`).join('\n')}
Kategori di cart: ${cartCategories.join(', ')}

MENU TERSEDIA (id | nama | kategori | harga | deskripsi):
${availableMenu.map(m => `${m.id} | ${m.name} | ${m.category} | Rp ${m.price.toLocaleString('id-ID')} | ${m.description || '-'}`).join('\n')}

${coPurchaseStr ? `RIWAYAT CO-PURCHASE (data nyata customer lain):\n${coPurchaseStr}\n` : ''}

TUGAS:
- Pilih 2-3 item dari MENU TERSEDIA yang paling cocok jadi pasangan untuk cart sekarang
- Prioritas: complementary (kopi + makanan), atau co-purchase pattern, atau item populer
- HINDARI rekomendasi yang categorinya sama persis (kalau cart isi 3 kopi, jangan rekomen kopi lagi)
- Output HANYA JSON valid, tanpa markdown fence, tanpa penjelasan tambahan:
{
  "recommendations": [
    {"id": "<id dari menu>", "reason": "<alasan singkat 1 kalimat menggugah, max 12 kata>"}
  ]
}`

    const raw = await aiComplete({ prompt, maxTokens: 500 })
    const text = raw.replace(/```json|```/g, '').trim()
    let parsed
    try { parsed = JSON.parse(text) }
    catch { return NextResponse.json({ recommendations: [], raw: text }) }

    return NextResponse.json(parsed)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
