# Berkesan Frontend — Deploy ke Vercel

## Sebelum Deploy

Edit file `public/js/api.config.js`, ganti URL dengan URL Railway backend kamu:

```js
const BACKEND_URL = "https://berkesan-backend.up.railway.app"; // ganti ini
```

## Langkah Deploy

1. Push folder ini ke GitHub sebagai repo baru (misal: `berkesan-frontend`)
2. Buka [vercel.com](https://vercel.com) → Login dengan GitHub
3. Klik **Add New Project** → pilih repo `berkesan-frontend`
4. Biarkan semua setting default → klik **Deploy**
5. Vercel akan memberikan URL publik (contoh: `https://berkesan.vercel.app`)

## Setelah Deploy

Kembali ke Railway backend, update variable `FRONTEND_URL` dengan URL Vercel kamu agar CORS berjalan dengan benar.

## Halaman yang Tersedia

| URL | Halaman |
|-----|---------|
| `/` | Halaman utama |
| `/login` | Login admin/kasir |
| `/order` | Halaman order pelanggan |
| `/about` | Tentang |
| `/admin` | Dashboard admin |
| `/kasir` | Panel kasir |
