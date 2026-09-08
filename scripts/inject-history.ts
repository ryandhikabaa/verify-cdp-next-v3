import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';

const prisma = new PrismaClient();

type DetectionInput = {
  deviceID: string;
  status: string;
  notes: string | null;
  imageData: string | null;
  latitude: number | null;
  longitude: number | null;
  qrPayload: string | null;
  qrHvalue: string | null;
  qrSecret1: string | null;
  qrSecret2: string | null;
  patternPayload: string | null;
  patternDecodePayload: string | null;
};

const SAMPLES: DetectionInput[] = [
  {
    deviceID: 'WEB-7f3a1c2b9d4e',
    status: 'AUTHENTIC',
    notes: 'Verifikasi berhasil. QR dan pola cocok dengan data terdaftar.',
    imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    latitude: -6.20876,
    longitude: 106.8456,
    qrPayload: 'V3QR-ASTRA-3R9K221',
    qrHvalue: '7A4F21C',
    qrSecret1: 'S3CR3T-4STRA-01',
    qrSecret2: 'S3CR3T-4STRA-02',
    patternPayload: '3R9K221ASTRA7A4F21C',
    patternDecodePayload: '3R9K221ASTRA7A4F21C',
  },
  {
    deviceID: 'android-samsung-a53-8f2d4e',
    status: 'COUNTERFEIT',
    notes: 'QR terdeteksi tetapi pola tidak cocok. Diduga produk palsu.',
    imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    latitude: -7.27562,
    longitude: 112.63028,
    qrPayload: 'V3QR-ASTRA-4B2L119',
    qrHvalue: 'B91E7A0',
    qrSecret1: 'S3CR3T-4STRA-11',
    qrSecret2: 'S3CR3T-4STRA-12',
    patternPayload: '4B2L119ASTRA000000',
    patternDecodePayload: '4B2L119ASTRA000000',
  },
  {
    deviceID: 'WEB-1c9e8d2a7b3f',
    status: 'AUTHENTIC',
    notes: 'Verifikasi cepat dari dashboard web.',
    imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    latitude: -6.91746,
    longitude: 107.61912,
    qrPayload: 'V3QR-YAMAHA-5P2114',
    qrHvalue: 'C3D0F55',
    qrSecret1: 'S3CR3T-YMH-01',
    qrSecret2: 'S3CR3T-YMH-02',
    patternPayload: '5P2114YAMAHA7A4F21C',
    patternDecodePayload: '5P2114YAMAHA7A4F21C',
  },
  {
    deviceID: 'iphone-15-6b7c8d9e',
    status: 'MISMATCH',
    notes: 'Payload QR dan pola berhasil dibaca namun tidak sinkron.',
    imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    latitude: -6.17511,
    longitude: 106.86504,
    qrPayload: 'V3QR-HONDA-8K0772',
    qrHvalue: 'D4E1A88',
    qrSecret1: 'S3CR3T-HND-01',
    qrSecret2: 'S3CR3T-HND-02',
    patternPayload: '8K0772HONDA0000000',
    patternDecodePayload: '8K0772HONDA0000000',
  },
  {
    deviceID: 'android-redmi-note-12-3a4b5c',
    status: 'AUTHENTIC',
    notes: 'Verifikasi ulang oleh petugas gudang. Semua checksum valid.',
    imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    latitude: -7.79558,
    longitude: 110.36949,
    qrPayload: 'V3QR-SUZUKI-6M3441',
    qrHvalue: 'E5F2B99',
    qrSecret1: 'S3CR3T-SZK-01',
    qrSecret2: 'S3CR3T-SZK-02',
    patternPayload: '6M3441SUZUKIE5F2B99',
    patternDecodePayload: '6M3441SUZUKIE5F2B99',
  },
];

function randomDevice(): string {
  return `WEB-${randomUUID().slice(0, 12)}`;
}

async function main() {
  const existing = await prisma.patternDetection.count();
  console.log(`PatternDetection existing rows before inject: ${existing}`);

  let inserted = 0;
  for (const sample of SAMPLES) {
    const createdAt = new Date(Date.now() - inserted * 3_600_000);
    await prisma.patternDetection.create({
      data: {
        id: randomUUID(),
        deviceID: sample.deviceID || randomDevice(),
        status: sample.status,
        notes: sample.notes,
        imageData: sample.imageData,
        latitude: sample.latitude,
        longitude: sample.longitude,
        qrPayload: sample.qrPayload,
        qrHvalue: sample.qrHvalue,
        qrSecret1: sample.qrSecret1,
        qrSecret2: sample.qrSecret2,
        patternPayload: sample.patternPayload,
        patternDecodePayload: sample.patternDecodePayload,
        createdAt,
        updatedAt: createdAt,
      },
    });
    inserted += 1;
  }

  const after = await prisma.patternDetection.count();
  console.log(`Inserted ${inserted} rows. Total now: ${after}`);

  const breakdown = await prisma.patternDetection.groupBy({
    by: ['status'],
    _count: {_all: true},
  });
  console.log('Status breakdown:', JSON.stringify(breakdown, null, 2));
}

main()
  .catch((error) => {
    console.error('Failed to inject history data:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
