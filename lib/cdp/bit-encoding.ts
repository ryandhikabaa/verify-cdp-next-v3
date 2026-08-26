import {
  CDP_CHECKSUM_BITS,
  CDP_CHECKSUM_MODULUS,
  CDP_CHECKSUM_MULTIPLIER,
  CDP_PAYLOAD_CHARS,
  CDP_TOTAL_BITS,
} from './constants';

/** Encodes a seed string into payload bits plus checksum bits. */
export function stringToBits(text: string): number[] {
  const cleanStr = text.substring(0, CDP_PAYLOAD_CHARS).padEnd(CDP_PAYLOAD_CHARS, ' ');
  const bits: number[] = [];
  let checksum = 0;

  for (let i = 0; i < CDP_PAYLOAD_CHARS; i++) {
    const charCode = cleanStr.charCodeAt(i);
    checksum = (checksum + charCode) * CDP_CHECKSUM_MULTIPLIER % CDP_CHECKSUM_MODULUS;
    for (let b = 7; b >= 0; b--) bits.push((charCode >> b) & 1);
  }

  for (let b = CDP_CHECKSUM_BITS - 1; b >= 0; b--) bits.push((checksum >> b) & 1);
  return bits;
}

/** Decodes payload bits back to text and verifies the embedded checksum. */
export function bitsToString(bits: number[]): {text: string; isValid: boolean} {
  if (bits.length < CDP_TOTAL_BITS) return {text: '', isValid: false};

  let text = '';
  let calcChecksum = 0;
  for (let i = 0; i < CDP_PAYLOAD_CHARS; i++) {
    let charCode = 0;
    for (let b = 0; b < 8; b++) {
      charCode = (charCode << 1) | bits[i * 8 + b];
    }
    calcChecksum = (calcChecksum + charCode) * CDP_CHECKSUM_MULTIPLIER % CDP_CHECKSUM_MODULUS;
    text += String.fromCharCode(charCode);
  }

  let readChecksum = 0;
  for (let b = 0; b < CDP_CHECKSUM_BITS; b++) {
    readChecksum = (readChecksum << 1) | bits[CDP_PAYLOAD_CHARS * 8 + b];
  }

  return {
    text: text.trim(),
    isValid: calcChecksum === readChecksum,
  };
}
