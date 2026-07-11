import { NextRequest, NextResponse } from 'next/server'
import { aiComplete, aiEnabled, aiErrorDetails } from '@/lib/ai'

export const runtime = 'nodejs'

type ReportInput = {
  date: string
  todayRevenue: number
  todayOrders: number
  todayByMethod: Record<string, { total: number; count: number }>
  todayTopItems: { name: string; qty: number; revenue: number }[]
  todayAvgRating: number | null
  todayPeakHour: number | null
  // Comparison
  yesterdayRevenue?: number
  yesterdayOrders?: number
  weekAvgRevenue?: number
}

export async function POST(req: NextRequest) {
  if (!aiEnabled()) {
    return NextResponse.json({ error: aiErrorDetails() }, { status: 503 })
  }

  try {
    const data: ReportInput = await req.json()
    const tanggal = new Date(data.date).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    const prompt = `Kamu adalah business analyst untuk Hallu Coffee & Sociality (kafe di Ternate). Buat laporan harian gaya WhatsApp yang ENAK DIBACA owner, dengan emoji dan insight tajam. Format Markdown WhatsApp (*tebal*, _miring_).

DATA HARI INI (${tanggal}):
- Revenue: Rp ${data.todayRevenue.toLocaleString('id-ID')}
- Transaksi: ${data.todayOrders}
- Per metode bayar: ${JSON.stringify(data.todayByMethod)}
- Top item: ${data.todayTopItems.slice(0, 5).map(i => `${i.name} x${i.qty} (Rp ${i.revenue.toLocaleString('id-ID')})`).join(', ')}
- Rating rata-rata: ${data.todayAvgRating || 'belum ada'}
- Jam paling ramai: ${data.todayPeakHour !== null ? `${data.todayPeakHour}:00` : 'tidak diketahui'}

PERBANDINGAN:
- Kemarin revenue: Rp ${(data.yesterdayRevenue || 0).toLocaleString('id-ID')}, ${data.yesterdayOrders || 0} order
- Rata-rata 7 hari: Rp ${(data.weekAvgRevenue || 0).toLocaleString('id-ID')}

INSTRUKSI:
1. Mulai dengan judul: 📊 *Laporan Hallu — ${tanggal}*
2. Beri ringkasan revenue + perbandingan vs kemarin & rata-rata mingguan (% naik/turun)
3. Sebut top 3 item dengan emoji yang sesuai
4. Beri 2-3 INSIGHT cerdas (bukan cuma sebut angka, tapi pattern atau kesimpulan)
5. Akhiri dengan REKOMENDASI singkat untuk besok (1-2 poin)
6. Total max 350 kata. Pakai bahasa santai, friendly, tapi profesional.
7. JANGAN buat angka palsu — gunakan hanya data yang diberi.

Output langsung pesan WA-nya saja, tanpa preamble.`

    const report = await aiComplete({ prompt, maxTokens: 800 })
    return NextResponse.json({ report })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
