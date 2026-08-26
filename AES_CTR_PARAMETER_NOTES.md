# AES-CTR-256 Parameter Notes

## Parameter yang dibutuhkan

### 1. Plaintext
Data asli yang akan diencrypt.
- isi: `seed` asli
- contoh: `VERIFY0001AB`
- saran:
  - fixed length
  - hanya `A-Z` dan `0-9`

### 2. Key
Kunci utama enkripsi.
- untuk `AES-256`: wajib `32 byte`
- generator dan verifier Dart harus memakai `key` yang sama

### 3. Counter / Nonce awal
Nilai awal untuk mode CTR.
- umumnya `16 byte`
- generator dan verifier harus memakai nilai yang sama
- ini wajib

### 4. Algoritma
- `AES-CTR`
- key size: `256-bit`

### 5. Encoding plaintext
Cara mengubah seed menjadi byte.
- saran: `ASCII` / `UTF-8` sederhana
- karena seed hanya `A-Z0-9`, format ini aman dan konsisten

### 6. Ciphertext
Hasil encrypt.
- panjang ciphertext = panjang plaintext
- jika plaintext `12 byte`, ciphertext juga `12 byte`
- ciphertext inilah yang ditanam ke pola

### 7. Aturan validasi hasil decrypt
Setelah verifier decrypt:
- hasil harus cocok format seed
- contoh regex:
  - `^[A-Z0-9]{12}$`
  - atau sesuai panjang final seed

## Yang harus sama antara Generator dan Verifier
Agar decrypt berhasil, keduanya harus sama persis pada:
- algoritma: `AES-CTR`
- key
- counter / nonce awal
- encoding
- format seed

## Paket minimum yang perlu diputuskan
Minimal yang harus ditetapkan sebelum implementasi:
- format seed final
- panjang seed final
- key `32 byte`
- counter `16 byte`
- aturan charset seed
- regex validasi hasil decrypt

## Rekomendasi sederhana
Untuk kasus ini:
- seed: `12 karakter`, hanya `A-Z0-9`
- key: `32 byte`
- counter: `16 byte`
- ciphertext ditanam ke pola
- database tetap menyimpan plaintext

## Template keputusan final
- seed format: `XXXXXXXXXXXX`
- key: `32 byte`
- counter: `16 byte`
- regex: `^[A-Z0-9]{12}$`
