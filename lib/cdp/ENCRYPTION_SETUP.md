# CDP Encryption Setup

## Environment variables

Isi di `.env`:

- `NEXT_PUBLIC_CDP_AES_KEY_B64`
  - wajib Base64
  - hasil decode harus `32 byte`
- `NEXT_PUBLIC_CDP_AES_COUNTER_B64`
  - wajib Base64
  - hasil decode harus `16 byte`

## Catatan penting

- Generator berjalan di browser, jadi parameter ini memang ikut ter-bundle ke client.
- Ini berarti **siapa pun yang punya akses ke aplikasi client pada akhirnya bisa mengekstrak key**.
- Jadi langkah ini hanya merapikan implementasi dan konsistensi lintas platform, **bukan** membuat secret client-side menjadi benar-benar tersembunyi.

## Rekomendasi operasional

- gunakan key production yang berbeda dari development
- rotasi key bila nanti format versi payload sudah ditambahkan
- samakan byte key dan counter ini persis di Flutter verifier
- bila nanti ingin lebih aman, pertimbangkan skema per-device / per-batch / server-assisted verification