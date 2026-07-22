// Kategori pengeluaran — dipakai kasir (input), admin (P&L), owner (agregat).
export const EXPENSE_CATEGORIES = [
  { value: 'bahan',       label: 'Bahan Baku',   icon: '📦' },
  { value: 'gaji',        label: 'Gaji / Upah',  icon: '🧑‍🍳' },
  { value: 'sewa',        label: 'Sewa Tempat',  icon: '🏠' },
  { value: 'listrik',     label: 'Listrik / Air', icon: '💡' },
  { value: 'operasional', label: 'Operasional',  icon: '🧾' },
  { value: 'lain',        label: 'Lain-lain',    icon: '•' },
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]['value']

export type Expense = {
  id: string
  category: string
  description: string | null
  amount: number
  expense_date: string // YYYY-MM-DD
  created_at: string
}

export const EXP_LABEL: Record<string, string> =
  Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]))
export const EXP_ICON: Record<string, string> =
  Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.icon]))

export const expLabel = (v: string) => EXP_LABEL[v] || v
export const expIcon = (v: string) => EXP_ICON[v] || '•'
