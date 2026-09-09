#!/usr/bin/env bash
#
# Deploy Dotvera-v3 on the server:
#   git pull -> install -> prisma generate -> migrate -> build -> pm2 restart
# Creates the pm2 process as "dotvera" when it is not registered yet.

set -euo pipefail

APP_NAME="dotvera"
cd "$(dirname "$0")"

if ! command -v pm2 > /dev/null 2>&1; then
  echo "pm2 tidak ditemukan. Install dulu: npm install -g pm2" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "PERINGATAN: .env tidak ada di $(pwd). Server.mjs memuat .env sendiri saat start." >&2
fi

echo "==> Pull kode terbaru"
# ff-only agar server tidak menerima merge commit diam-diam saat riwayatnya menyimpang.
git pull --ff-only

echo "==> Install dependencies"
npm ci || npm install

echo "==> Generate Prisma client"
npm run prisma:generate

echo "==> Apply migrasi database (no-op jika tidak ada yang pending)"
npm run prisma:migrate

echo "==> Build production bundle"
npm run build

if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  echo "==> Restart pm2 process '$APP_NAME'"
  # --update-env agar perubahan environment di shell deploy ikut terpakai.
  pm2 restart "$APP_NAME" --update-env
else
  echo "==> Proses '$APP_NAME' belum ada di pm2, membuat baru"
  # NODE_ENV=production diperlukan: server.mjs memakainya untuk memilih mode Next.
  # HTTPS tetap opt-in lewat env HTTPS=true; default server sekarang HTTP.
  NODE_ENV=production pm2 start server.mjs --name "$APP_NAME" --time
  # save agar proses di-resurrect saat reboot (pair dengan `pm2 startup`).
  pm2 save
fi

echo "==> Status pm2"
pm2 status
