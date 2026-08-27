-- ============================================================
-- HALLU — Migrasi: DAFTAR BAHAN (master bahan baku)
-- Supaya harga beli & takaran kemasan cukup diisi SEKALI, lalu dipakai
-- ulang di semua menu waktu mengisi HPP.
-- Jalankan sekali di SQL Editor tiap DB outlet. Idempotent.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists bahan (
  id         uuid primary key default gen_random_uuid(),
  nama       text not null,
  harga_beli numeric not null default 0,   -- Rp per kemasan
  isi        numeric not null default 0,   -- isi kemasan dalam satuan pakai
  satuan     text not null default 'g',    -- g | ml | pcs | sdm | sdt | porsi
  created_at timestamptz default now()
);

-- Untuk DB lama yang tabelnya sudah terlanjur ada
alter table bahan add column if not exists nama       text;
alter table bahan add column if not exists harga_beli numeric not null default 0;
alter table bahan add column if not exists isi        numeric not null default 0;
alter table bahan add column if not exists satuan     text not null default 'g';
alter table bahan add column if not exists created_at timestamptz default now();

-- Cegah bahan yang sama ditambah berkali-kali ("Kopi" vs "kopi " vs "KOPI")
create unique index if not exists idx_bahan_nama on bahan (lower(trim(nama)));

alter table bahan enable row level security;
drop policy if exists "hallu_all_bahan" on bahan;
create policy "hallu_all_bahan" on bahan for all using (true) with check (true);

-- GRANT eksplisit — WAJIB. DB baru biasanya "Automatically expose new tables"
-- dimatikan, jadi tanpa baris ini muncul "permission denied for table bahan".
-- service_role ikut, kalau tidak /api/secure gagal padahal kuncinya benar.
grant select, insert, update, delete on bahan to anon, authenticated, service_role;
