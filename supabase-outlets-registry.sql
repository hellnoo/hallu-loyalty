-- ============================================================
-- HALLU — Registry outlet (dipakai fitur "+ Tambah Outlet" di Admin
-- Pusat). Jalankan SEKALI di DB PUSAT saja. Idempotent.
-- ============================================================
-- Menyimpan daftar outlet (nama, url, anon, schema, service_role) supaya
-- outlet baru bisa ditambah dari dalam app tanpa edit OUTLETS_JSON di
-- Vercel + redeploy. HANYA bisa diakses server (service_role) — anon/
-- authenticated SENGAJA TIDAK diberi grant sama sekali (default-deny
-- Postgres: tanpa GRANT eksplisit, role apa pun ditolak akses tabel ini,
-- RLS di bawah cuma lapisan kedua).

create extension if not exists pgcrypto;

create table if not exists public.outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  anon text not null,
  schema text not null default 'public',
  service_role text,
  created_at timestamptz default now()
);

alter table public.outlets enable row level security;
-- Sengaja TIDAK ada policy untuk anon/authenticated — tabel ini hanya
-- boleh disentuh lewat service_role (dipakai server route /api/central/*),
-- yang otomatis bypass RLS di Supabase.
