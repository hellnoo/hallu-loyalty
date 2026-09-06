-- ============================================================
-- HALLU — Migrasi: TEMA HALAMAN MENU
-- Satu kolom saja. Nilainya kunci tema dari src/lib/themes.ts:
--   'gelap' (bawaan) | 'kanvas' | 'pasar' | 'daun'
-- Kosong / NULL = pakai 'gelap', jadi outlet lama tidak berubah.
-- Jalankan sekali di tiap DB outlet. Idempotent.
-- ============================================================

alter table public.store_settings add column if not exists brand_theme text;

-- Tema bukan rahasia (memang tampil ke pelanggan) → ikut kolom yang boleh
-- dibaca kunci publik. Password & kunci AI tetap TIDAK ikut.
revoke select on public.store_settings from anon, authenticated;
grant select (
  id, open_time, close_time, open_days, is_manually_closed, employees,
  brand_name, brand_tagline, brand_arabic, brand_city, brand_wa, brand_ig,
  brand_address, brand_lat, brand_lng, brand_logo, brand_color, brand_accent,
  brand_theme
) on public.store_settings to anon, authenticated;
grant insert, update, delete on public.store_settings to anon, authenticated;
grant select, insert, update, delete on public.store_settings to service_role;
