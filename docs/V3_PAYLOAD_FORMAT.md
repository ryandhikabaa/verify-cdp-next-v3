# V3 Portable Payload Format

**Status:** Locked TypeScript Phase 1 contract; cross-platform conformance required before release
**Version:** 1
**Consumers:** Web TypeScript, Flutter/Dart, Android/Kotlin, iOS/Swift

## Goal

The generator and all verifiers must produce and consume identical bytes. No platform-specific serialization, cryptography, character encoding, or Reed–Solomon package is part of this contract.

## Character alphabet

The payload alphabet is exactly:

```text0
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_
```

The alphabet index is the 6-bit value from 0 through 63. Payload length is measured in characters, not bytes. Maximum length is 24 characters. UTF-8, spaces, and Unicode characters are not accepted.
 
## Data block

The data block is exactly 22 bytes, indexed from zero:

| Offset | Length | Meaning |
|---:|---:|---|
| 0 | 1 | Version, always `0x01` |
| 1 | 1 | Payload length, `0..24` |
| 2..19 | 18 | Six-bit packed payload, MSB first |
| 20..21 | 2 | CRC-16-CCITT, big-endian |

The unused payload bits and unused payload bytes are zero. The CRC covers bytes `0..19`, including all zero padding.

### Six-bit packing

Payload values are written most-significant bit first, consecutively, beginning at bit 16 of the data block. The first character occupies bits 16..21. The final possible character ends at bit 159. No byte-order conversion is applied to the packed data.

## CRC

CRC-16-CCITT parameters:

```text
width        = 16
polynomial   = 0x1021
initial      = 0xFFFF
input_reflect= false
output_reflect=false
xor_out      = 0x0000
```

The resulting CRC is written high byte first, then low byte.

## Reed–Solomon

The complete codeword is exactly 32 bytes:

```text
22 data bytes + 10 parity bytes
```

The implementation must use GF(256) with:

```text
primitive polynomial = 0x11D
field generator      = 0x02
first consecutive root= 0
parity symbols       = 10
```

The generator polynomial is the product of `(x - α^i)` for `i = 0..9`, with coefficients ordered highest degree first. Data bytes are the message symbols in offset order; parity bytes follow the data bytes. Decoder correction is bounded to five unknown byte errors. After correction, the decoder must validate version, length, alphabet values, zero padding, and CRC. Uncorrectable data is rejected.

All arithmetic is GF(256); subtraction and addition are XOR. Implementations must not depend on a platform or third-party Reed–Solomon library.

## Canonical pipeline

```text
payload string
→ validate alphabet and length
→ pack data block
→ calculate CRC
→ append Reed–Solomon parity
→ distribute 256 codeword bits into the V3 matrix
```

## Compatibility requirements

- Web, Flutter/Dart, Kotlin, and Swift must pass the same JSON test vectors.
- The generator stores the original payload and V3 metadata in the database; the image is the transport artifact, not the source of truth.
- A verifier returns a payload only after all structural, Reed–Solomon, and CRC checks pass.
- V2 payloads and images are outside this format and must not be accepted by the V3 verifier.
