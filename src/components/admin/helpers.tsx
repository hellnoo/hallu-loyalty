import type { MenuItem, StoreSettings } from '@/types'
import { DEFAULT_EMPLOYEES } from '@/types'
import { fmtWITDateTime, toWITDateString } from '@/lib/business-day'

export function margin(price: number, hpp: number) {
  if (!hpp || !price) return null
  return Math.round((price - hpp) / price * 100)
}
export function marginColor(m: number) {
  if (m >= 60) return 'text-green-400'
  if (m >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

export type FormData = Omit<MenuItem, 'id' | 'created_at' | 'image_url' | 'model_3d_url' | 'model_3d_task_id'>
export const BLANK: FormData = { name: '', description: '', price: 0, hpp: 0, hpp_components: [], category: 'Kopi', available: true }

// Compress & resize gambar sebelum upload (max 900px, JPEG 82%)
export async function compressImage(file: File, maxPx = 900, quality = 0.82): Promise<Blob> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const ratio = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => resolve(blob!), 'image/jpeg', quality)
    }
    img.src = url
  })
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-h-red' : 'bg-h-border'}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

export type AdminTab = 'menu' | 'hpp' | 'analitik' | 'outlet' | 'pengaturan'

export const DEFAULT_SETTINGS: StoreSettings = { id: 1, open_time: '08:00', close_time: '22:00', open_days: 'Senin – Minggu', is_manually_closed: false, employees: [...DEFAULT_EMPLOYEES] }

export type OrderRow = {
  id: string
  table_number: number
  items: { id: string; name: string; price: number; qty: number }[]
  status: string
  customer_name: string | null
  payment_method: string | null
  rating: number | null
  created_at: string
}

export function exportCsv(orders: OrderRow[]) {
  const rows = [
    ['ID', 'Tanggal', 'Meja', 'Customer', 'Item', 'Total', 'Status', 'Bayar', 'Rating'],
    ...orders.map(o => {
      const total = o.items.reduce((s, i) => s + i.price * i.qty, 0)
      const itemList = o.items.map(i => `${i.name}x${i.qty}`).join(' | ')
      return [
        o.id.slice(0, 8),
        fmtWITDateTime(o.created_at),
        o.table_number,
        o.customer_name || '-',
        itemList,
        total,
        o.status,
        o.payment_method || '-',
        o.rating || '-',
      ]
    })
  ]
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = `hallu-rekap-${toWITDateString(new Date())}.csv`
  a.click(); URL.revokeObjectURL(url)
}
