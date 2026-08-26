import type {VerifyStatus} from '@/lib/types';

export type SharedVerifierInput = {
  patternFound: boolean;
  decryptSucceeded: boolean;
  checksumValid: boolean;
  payloadMode: 'legacy' | 'encrypted' | 'unknown';
  rawPayloadText: string;
};

export function isLikelyLegacyPayload(value: string) {
  return /^[A-Z0-9]{1,12}$/.test(value.trim());
}

export function resolveSharedVerifyStatus({
  patternFound,
  payloadMode,
  decryptSucceeded,
}: SharedVerifierInput): VerifyStatus {
  if (!patternFound) {
    return 'COUNTERFEIT';
  }

  if (payloadMode === 'legacy') {
    return 'COUNTERFEIT';
  }

  if (payloadMode === 'encrypted' && decryptSucceeded) {
    return 'AUTHENTIC';
  }

  return 'COUNTERFEIT';
}

export function buildSharedTrackingNotes({
  patternFound,
  decryptSucceeded,
  checksumValid,
  payloadMode,
  rawPayloadText,
}: SharedVerifierInput) {
  if (!checksumValid) {
    return 'Kode keamanan tidak valid atau tidak dapat dikenali.';
  }

  if (payloadMode === 'encrypted' && decryptSucceeded && !patternFound) {
    return 'Keaslian produk tidak dapat dikonfirmasi.';
  }

  if (payloadMode === 'encrypted' && decryptSucceeded) {
    return 'Produk berhasil diverifikasi dan dinyatakan autentik.';
  }

  if (payloadMode === 'legacy' || (rawPayloadText && isLikelyLegacyPayload(rawPayloadText))) {
    return 'Kode keamanan tidak valid atau tidak dapat dikenali.';
  }

  if (rawPayloadText) {
    return 'Keaslian produk tidak dapat dikonfirmasi.';
  }

  return 'Keaslian produk tidak dapat dikonfirmasi.';
}