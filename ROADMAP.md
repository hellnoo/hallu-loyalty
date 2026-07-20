# HALLU — Roadmap Eksekusi

> Dokumen ini hasil penalaran mendalam (Fable 5) supaya eksekusi bisa dikerjakan
> model yang lebih hemat (Opus 4.8) tanpa mikir ulang. **Cara pakai:** buka sesi
> baru, bilang: _"Baca ROADMAP.md, kerjakan Item N sampai selesai: build, commit,
> push ke remote hallu-loyalty branch main."_ Satu item per sesi. Coret item yang
> selesai (ganti ⬜ jadi ✅).

**Konteks tetap:** Next.js 15 App Router · Supabase (project "hallu loyalty",
tabel: menu_items, orders, store_settings, shifts, push_subscriptions) · Tailwind
token: h-bg/h-dark/h-card/h-border/h-red(maroon #7C1515)/h-cream(#D4B896)/h-muted ·
Brand: HALLU, maroon+cream · push ke remote `hallu-loyalty` (BUKAN `sapulidi`).
Rekap harian pakai business-day cutoff jam 05:00 — pertahankan di fitur baru.

---

## Item 0 ✅ — Pecah file raksasa (SELESAI)

**Hasil:** helper bersama dipindah ke `src/lib/format.ts`, `src/lib/store-hours.ts`
(dedupe 3x calcIsOpen/isStoreOpen), `src/lib/business-day.ts`, `src/components/icons.tsx`.
Menu dipecah ke `src/components/menu/` (atmosphere, ChatbotWidget, ShowcaseModal,
ItemCard) → page.tsx 1267→566. Kasir ke `src/components/kasir/` (helpers, components)
→ page.tsx 1612→943. Admin helper ke `src/components/admin/helpers.tsx` → 1324→1233
(komponen AdminPage sengaja tidak dipecah — terlalu berisiko, banyak shared state).
Build + tsc lolos, bundle size identik, 4 halaman verified 200 tanpa error.

<details><summary>Prompt asli (arsip)</summary>

**Kenapa:** kasir/page.tsx 1.612 baris, admin/page.tsx 1.324, menu/page.tsx 1.267.
Tiap sesi edit harus baca file penuh = boros token. Setelah dipecah, sesi Opus cuma
baca komponen yang relevan.

**Prompt untuk Opus:**
> Refactor tanpa mengubah perilaku sama sekali. Pecah `src/app/kasir/page.tsx`,
> `src/app/admin/page.tsx`, `src/app/menu/page.tsx` menjadi komponen di
> `src/components/kasir/`, `src/components/admin/`, `src/components/menu/`.
> Pindahkan juga helper bersama (formatRp, business-day, calcIsOpen, ikon SVG,
> CAT_ATM, generatePlaceholder) ke `src/lib/format.ts`, `src/lib/business-day.ts`,
> `src/lib/store-hours.ts`, `src/components/icons.tsx`. Satu sumber kebenaran —
> hapus duplikat calcIsOpen/isStoreOpen (3 kopi identik). Per file target < 400
> baris. Jalankan `node_modules/.bin/next build` harus sukses. JANGAN ubah logika,
> style, atau teks apapun.

</details>

---

## FASE 1 — Operasional harian (dampak paling terasa)

### Item 1 ⬜ — Varian menu: ukuran, es, gula, topping
**Kenapa:** kafe nyata butuh "less sugar / no ice / large". Sekarang customer nulis
di catatan → rawan salah baca barista. Ini gap operasional terbesar.

**Desain (sudah diputuskan, jangan diubah):**
- SQL: `alter table menu_items add column if not exists variants jsonb default '[]'::jsonb;`
  Bentuk: `[{ "name":"Ukuran", "required":true, "choices":[{"label":"Regular","delta":0},{"label":"Large","delta":5000}] }, { "name":"Gula", "required":false, "choices":[{"label":"Normal","delta":0},{"label":"Less Sugar","delta":0}] }]`
- Item order di `orders.items` ditambah field opsional `opts: string[]` (contoh
  `["Large","Less Sugar"]`) dan `price` yang tersimpan = harga final per unit
  (base + total delta). Kasir & struk WA menampilkan opts di bawah nama item.
- Menu customer: kalau item punya variants, tombol [+] membuka bottom-sheet pilih
  varian (required harus dipilih) lalu tambah ke cart. Cart key bukan lagi `id`
  tapi `id + JSON opts` supaya varian beda = baris beda.
- Admin form: editor varian (tambah grup, tambah pilihan, delta harga) di bawah
  editor HPP, pola UI-nya samakan dengan HPP components editor yang sudah ada.

**Prompt untuk Opus:**
> Baca ROADMAP.md Item 1. Implement persis desain tersebut. Sentuh:
> src/types/index.ts (MenuItem.variants, OrderItem.opts), halaman/komponen menu
> (bottom-sheet varian + cart per kombinasi), kasir (tampilkan opts di OrderCard,
> struk WA msgStruk, modal struk), admin (editor varian di form item). Tambahkan
> SQL-nya ke supabase-setup.sql (idempotent) dan tulis di ringkasan akhir supaya
> owner run 1 baris ALTER TABLE di Supabase. Build harus sukses.

### Item 2 ⬜ — Pencarian & filter cepat di menu customer
**Prompt untuk Opus:**
> Di halaman menu customer, tambah search bar sticky di bawah tab kategori:
> filter client-side by nama/deskripsi (case-insensitive), plus chip filter cepat
> "≤ 20rb", "Dingin", "Panas" (match kata di nama/deskripsi). Kosongkan search →
> tampilan normal. Styling ikuti token h-* yang ada. Tanpa library baru.

### Item 3 ⬜ — Tombol "Panggil Pelayan"
**Desain:** tabel baru `waiter_calls (id uuid pk default gen_random_uuid(),
table_number int, created_at timestamptz default now(), resolved boolean default false)`
+ realtime publication + RLS policy sama pola tabel lain. Tombol kecil 🛎 di header
menu customer (cooldown 60 detik via localStorage). Kasir: subscribe realtime INSERT
→ banner kuning "Meja N memanggil" + bunyi playNewOrderSound, tombol "Selesai"
set resolved=true.

**Prompt untuk Opus:**
> Baca ROADMAP.md Item 3, implement persis. Tambah SQL idempotent ke
> supabase-setup.sql dan cantumkan CREATE TABLE-nya di ringkasan akhir untuk
> dijalankan owner di Supabase SQL Editor.

### Item 4 ✅ — Koordinat Google Maps (SELESAI)
Titik persis ditemukan via Google Maps: **Taman Fitness Sunyie Parade / Cafe Taman
Fitness** (plus code Q9VP+C69) = `0.7935511, 127.3855782` — dipasang di LOC
`src/app/page.tsx`. Kalau pin perlu digeser beberapa meter, tinggal ubah 2 angka itu.
**Saran marketing:** daftarkan "Hallu Coffee & Sociality" di Google Business Profile
(business.google.com) — sekarang cari "Hallu" di Maps malah nyasar ke kafe kompetitor.

---

## FASE 2 — Loyalty member (repo-nya aja bernama hallu-loyalty 😄)

### Item 5 ⬜ — Poin member berbasis no. HP
**Desain (final):**
- SQL: `create table if not exists members (phone text primary key, name text,
  points int not null default 0, visits int not null default 0,
  created_at timestamptz default now());` + trigger postgres: saat `orders.status`
  berubah menjadi 'done' dan `phone` tidak null → upsert member, `points +=
  floor(total/10000)` (1 poin per Rp 10.000), `visits += 1`. Trigger di DB supaya
  tidak tergantung client. Total dihitung dari jsonb items di dalam fungsi trigger.
- Menu customer: setelah isi no. HP di cart, tampilkan "⭐ Poin kamu: N" (fetch by
  phone). Di layar "Selesai": tampilkan poin baru.
- Kasir: tab/section "Member" — cari by no HP, lihat poin, tombol "Tukar poin"
  (kurangi manual, catat di kolom baru `orders.note` order aktif atau langsung
  update points). Aturan tukar: 100 poin = potongan Rp 10.000 (kasir kurangi
  harga manual di kasir, sistem cuma memotong poin).
- Admin Analitik: card "Top Member" (nama/HP, visits, points).

**Prompt untuk Opus:**
> Baca ROADMAP.md Item 5, implement persis desain, termasuk fungsi+trigger
> postgres di supabase-setup.sql (idempotent, `create or replace function` +
> `drop trigger if exists`). Cantumkan SQL lengkap di ringkasan akhir.

---

## FASE 3 — Landing & tampilan "hidup"

### Item 6 ⬜ — Menu Unggulan (featured)
SQL: `alter table menu_items add column if not exists featured boolean default false;`
Admin: toggle ⭐ per item di tabel Kelola Menu. Landing: section "Menu" menampilkan
featured dulu (fallback: 12 pertama seperti sekarang kalau belum ada featured).

### Item 7 ⬜ — Bukti sosial: rating asli di landing
Landing tambah section kecil setelah "Tentang Kami": rata-rata bintang + jumlah
ulasan, dihitung dari `orders.rating` (query aggregate client-side). Tampilkan
hanya kalau ada ≥ 5 ulasan dan rata-rata ≥ 4.0 (jangan pajang kalau jelek 😄).

### Item 8 ⬜ — Promo banner
SQL: `alter table store_settings add column if not exists promo_text text;`
Admin Pengaturan: input teks promo (kosong = nonaktif). Menu customer + landing:
strip banner tipis maroon di atas ("🎉 {promo_text}") kalau terisi.

**Prompt untuk Opus (gabung 6+7+8 satu sesi):**
> Baca ROADMAP.md Item 6, 7, 8 — implement ketiganya, SQL idempotent ke
> supabase-setup.sql, cantumkan ALTER TABLE di ringkasan akhir.

---

## FASE 4 — Keamanan & keandalan (tidak terlihat tapi penting)

### Item 9 ⬜ — ⚠️ Hardening RLS (risiko nyata, kerjakan sebelum ramai)
**Masalah:** policy sekarang `for all using (true)` di semua tabel — anon key itu
publik (ada di bundle JS), artinya siapapun yang paham teknis bisa UPDATE/DELETE
menu, harga, settings langsung ke DB tanpa password.

**Desain:**
- Tambah env `SUPABASE_SERVICE_ROLE_KEY` (Vercel) — JANGAN pernah diekspos ke client.
- Buat `src/lib/supabase-admin.ts` (service client, server-only) + API routes
  `/api/admin-db/*` yang cek header `x-admin-password` == ADMIN_PASSWORD (atau
  KASIR_PASSWORD untuk operasi kasir) sebelum mutasi.
- Pindahkan mutasi admin (menu CRUD, settings, cleanup) & kasir (update status
  order, shifts) ke routes tsb; front-end simpan password di localStorage yang
  sudah ada dan kirim sebagai header.
- Ganti policy: menu_items/store_settings → anon SELECT only; orders → anon
  INSERT+SELECT, UPDATE hanya kolom rating (pakai policy `with check`); shifts &
  waiter_calls & members → SELECT only (mutasi via server).
- Update supabase-setup.sql dengan policy baru (drop policy lama hallu_all_*).

**Catatan effort:** ini item paling besar (menyentuh banyak call). Boleh dipecah
2 sesi: (a) infrastruktur routes + admin, (b) kasir + policies final.

### Item 10 ⬜ — Unit test logika bisnis
Vitest minimal: `calcIsOpen`/jendela lewat tengah malam, `getBusinessDayBounds`,
perhitungan poin member, formatRp. Tambah script `"test": "vitest run"` dan jalankan
di sesi mana pun sebelum push. Mencegah regresi kayak bug "Tutup 24 jam" kemarin.

---

## TRACK DEMO BI (prioritas bisnis — untuk pitch ke Bank Indonesia)

### Item 11 ✅ — White-label: brand via env var (SELESAI)
**Hasil:** src/lib/brand.ts (BRAND, BRAND_NICE, BRAND_FULL, WA_LINK, WA_DISPLAY).
55+ hardcode di 14 file diganti. Diverifikasi 2 mode di preview: tanpa env =
HALLU identik; dengan env = KEDAIKU/Warung Digital total, Arabic tersembunyi.
Catatan: public/manifest.json & icon.svg masih statis Hallu (PWA install saja,
tidak terlihat di demo web — genericize nanti kalau perlu).

<details><summary>Spec asli (arsip)</summary>
**Konteks:** Supabase demo `kedaiku-demo` (ref yzqyxchhpnxhtibanbdq, org hellnoo)
sudah dibuat & di-seed (10 menu netral + 48 order dummy 14 hari). Deploy demo =
repo INI juga, Vercel project kedua dengan env beda. Blocker: brand HALLU hardcoded.

**Desain (final, jangan diubah):**
- Buat `src/lib/brand.ts`:
  \`\`\`ts
  export const BRAND = {
    name:    process.env.NEXT_PUBLIC_BRAND_NAME    || 'HALLU',
    tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || 'Coffee & Sociality',
    arabic:  process.env.NEXT_PUBLIC_BRAND_ARABIC  || 'هالو',   // '' = sembunyikan
    city:    process.env.NEXT_PUBLIC_BRAND_CITY    || 'Ternate',
    wa:      process.env.NEXT_PUBLIC_BRAND_WA      || '6281245400031',
    ig:      process.env.NEXT_PUBLIC_BRAND_IG      || 'hall.ucffe',
    address: process.env.NEXT_PUBLIC_BRAND_ADDRESS || 'Taman Fitness Sunyie Parade, Ternate, Maluku Utara',
    lat:     Number(process.env.NEXT_PUBLIC_BRAND_LAT || 0.7935511),
    lng:     Number(process.env.NEXT_PUBLIC_BRAND_LNG || 127.3855782),
  }
  \`\`\`
- Ganti SEMUA hardcode "HALLU"/"Hallu"/"هالو"/WA/IG/LOC/alamat dengan BRAND.* di:
  layout.tsx (metadata), page.tsx (nav/hero/lokasi/footer/sosmed), menu (header +
  watermark "HALLU" di generatePlaceholder atmosphere.tsx), kasir (helpers.ts:
  OWNER_WA, msgStruk "HALLU COFFEE & SOCIALITY", buildDailyReport; page header;
  screensaver), admin (header), 5 route AI (nama kedai di prompt — NEXT_PUBLIC env
  terbaca juga di server, langsung impor BRAND).
- Default = nilai Hallu → TANPA env baru, produksi 100% tidak berubah.
- Verifikasi: build lolos + preview tanpa env tetap tampil HALLU persis.

**Prompt untuk Opus:**
> Baca ROADMAP.md Item 11, implement persis. Jangan ubah tampilan default sedikitpun
> (default env = Hallu). Build, verifikasi preview, commit, push hallu-loyalty main.

</details>

### Item 12 ✅ — Deploy demo "KedaiKu" (SELESAI — LIVE)
**https://kedaiku-demo.vercel.app** — Vercel project kedua dari repo yang sama,
env: Supabase demo (yzqyxchhpnxhtibanbdq, 10 menu + 48 order dummy), brand
KEDAIKU/"Warung Digital"/arabic disembunyikan ('-'). Login demo:
admin `demoadmin26`, kasir `demokasir26`. Verified 200 + brand benar;
produksi Hallu tidak terpengaruh. Auto-deploy dari main (kedua project).
**Sisa manual (owner):** tambah env `AI_API_KEY` (key Groq yang sama) di
Vercel project kedaiku-demo → Redeploy, supaya chatbot AI jalan di demo.

---

## TRACK FRANCHISE (keputusan: franchise dibangun DI hallu-loyalty, bukan franc-ops)

> Konteks: repo terpisah `hellnoo/franc-ops` (D:\franc-ops, DB di akun Supabase
> thatwokz `ehrohsbzvlbtpeqylbdg`) = dashboard multi-outlet owner/mitra/kasir dengan
> Supabase Auth + RLS granular + expenses. Keputusan: hallu-loyalty jadi platform
> tunggal; franc-ops jadi referensi pola (auth/RLS, expenses, HPP snapshot) dan
> pensiun setelah F4. Alasan: konsistensi pengalaman outlet (QR/AI/realtime),
> satu codebase untuk solo dev, white-label sudah terbukti (demo KedaiKu).

### Item F1 ✅ (bisa dilakukan kapan saja, tanpa kode)
Outlet franchise baru = deploy pola KedaiKu: Supabase baru (jalankan
supabase-setup.sql) + Vercel project baru dari repo ini + env brand Hallu dengan
NEXT_PUBLIC_BRAND_ADDRESS/CITY beda per outlet + password admin/kasir per outlet.

### Item F2 ⬜ — Dashboard Owner agregat lintas outlet (/owner)
- Halaman baru `/owner` (password baru env OWNER_PASSWORD, pola sama admin).
- Config outlet via env server-only `OUTLETS_JSON`:
  `[{"name":"Hallu Pusat","url":"https://<ref>.supabase.co","anon":"<key>"},...]`
- Server route `/api/owner/summary` membaca SEMUA outlet (createClient per outlet,
  parallel): omzet business-day hari ini, jumlah order, 7 hari terakhir, top item.
- UI: kartu per outlet + total agregat + banding antar outlet. Read-only.
- Ini menggantikan fungsi inti franc-ops (pantau semua outlet dari satu layar).

### Item F3 ⬜ — Expenses per outlet + P&L (port dari franc-ops)
- SQL: tabel `expenses (id, category check in bahan/gaji/sewa/listrik/operasional/lain,
  description, amount, expense_date, created_at)` — per DB outlet, idempotent.
- Kasir: tab/section "Pengeluaran" (input harian sederhana + list hari ini).
- Admin Analitik: P&L bulanan = revenue − HPP terjual − expenses per kategori.
- /owner (F2): agregat P&L lintas outlet.

### Item F4 ⬜ — Auth & RLS proper (gabung dengan Item 9, pakai pola franc-ops)
Supabase Auth (email/password) role owner/mitra/kasir + RLS granular per peran
meniru `D:\franc-ops\supabase-setup.sql` (get_my_role() security definer, policy
per tabel). Mitra login → lihat outlet-nya saja. Setelah ini franc-ops pensiun.

### Catatan HPP snapshot (kerjakan bersama Item 1 varian)
Saat submit order, simpan juga `hpp` per item (snapshot dari menu_items saat itu)
di jsonb items — laporan margin historis akurat walau HPP menu berubah.

---

## PARKIR (nanti kalau makin ramai — jangan dikerjakan dulu)
- Kitchen Display System (tablet dapur terpisah)
- Expense tracker + P&L bulanan penuh
- Printer thermal Bluetooth (butuh hardware dulu)
- WA broadcast promo / auto-review Google Maps
- Inventory & stok bahan baku (auto-deduct dari HPP components)

---

## Urutan yang saya sarankan
`0 → 1 → 5 → 6+7+8 → 2 → 3 → 9 → 10` — Item 0 dulu (hemat kuota), lalu varian
(operasional), lalu loyalty (retensi), lalu landing (marketing), sisanya menyusul.
Item 4 (koordinat) kapan saja — cuma 1 menit begitu owner kirim koordinat.
