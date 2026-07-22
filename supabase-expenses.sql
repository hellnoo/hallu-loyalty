-- ============================================================
-- HALLU — Migrasi: PENGELUARAN (expenses) untuk P&L / Laba-Rugi
-- Jalankan sekali di SQL Editor tiap DB outlet (pusat + mitra).
-- Idempotent — aman dijalankan ulang, tidak menimpa data.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'operasional', -- bahan | gaji | sewa | listrik | operasional | lain
  description text,
  amount int not null default 0,
  expense_date date not null default ((now() at time zone 'Asia/Jayapura')::date),
  created_at timestamptz default now()
);
-- Untuk DB lama yang tabelnya sudah ada tapi kolom belum lengkap
alter table expenses add column if not exists category text not null default 'operasional';
alter table expenses add column if not exists description text;
alter table expenses add column if not exists amount int not null default 0;
alter table expenses add column if not exists expense_date date not null default ((now() at time zone 'Asia/Jayapura')::date);
alter table expenses add column if not exists created_at timestamptz default now();

create index if not exists idx_expenses_date on expenses (expense_date);

-- RLS: app pakai anon key, auth admin/kasir di level aplikasi (pola sama tabel lain)
alter table expenses enable row level security;
drop policy if exists "hallu_all_expenses" on expenses;
create policy "hallu_all_expenses" on expenses for all using (true) with check (true);

-- Realtime (opsional — biar update pengeluaran instan)
do $$
begin
  alter publication supabase_realtime add table expenses;
exception when duplicate_object then null;
end $$;
