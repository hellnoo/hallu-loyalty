-- ============================================================
-- HALLU — Password admin/kasir per outlet DISIMPAN DI DATABASE
-- supaya bisa dilihat & diganti dari Admin Pusat (tanpa buka Vercel).
-- Jalankan di SETIAP DB outlet (pusat, brew, basecamp, mitra...).
-- Idempotent — aman dijalankan ulang.
-- ============================================================
-- Desain keamanan:
--  • Kolom password ADA di store_settings, tapi anon/authenticated
--    SENGAJA TIDAK boleh SELECT kolom itu (grant per-kolom di bawah).
--    Jadi kunci publik yang ikut ke-bundle TIDAK bisa membaca password.
--  • Login tetap bisa jalan tanpa service_role di outlet: lewat fungsi
--    SECURITY DEFINER `cek_password()` yang cuma balikin true/false —
--    tidak pernah membocorkan isi passwordnya.
--  • Yang bisa MEMBACA & MENGUBAH password hanya service_role, yaitu
--    lewat Admin Pusat (/api/central/settings) yang dijaga password pusat.
-- ============================================================

alter table public.store_settings add column if not exists admin_password text;
alter table public.store_settings add column if not exists kasir_password text;

-- ── Grant per-kolom: anon boleh baca setelan toko, TAPI bukan password ──
revoke select on public.store_settings from anon, authenticated;
grant select (id, open_time, close_time, open_days, is_manually_closed, employees)
  on public.store_settings to anon, authenticated;
-- Tulis setelan (jam buka, karyawan) tetap boleh lewat app seperti biasa
grant insert, update, delete on public.store_settings to anon, authenticated;
grant select, insert, update, delete on public.store_settings to service_role;

-- ── Fungsi cek password: balikin true/false saja ──
create or replace function public.cek_password(peran text, sandi text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    case peran
      when 'admin' then admin_password is not null and admin_password = sandi
      when 'kasir' then kasir_password is not null and kasir_password = sandi
      else false
    end, false)
  from public.store_settings where id = 1;
$$;

revoke all on function public.cek_password(text, text) from public;
grant execute on function public.cek_password(text, text) to anon, authenticated, service_role;
