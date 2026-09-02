# Verify CDP Web V3 — Development Roadmap

**Status:** Phase 4 complete; ready to proceed with Phase 5 acceptance work
**Baseline:** `verify-cdp-next-v2`  
**Target project:** `verify-cdp-next-v3`  
**Last updated:** 2026-08-26

## 1. Purpose

V3 is a controlled redesign of the web generator and verifier based on v2, focused on improving detection reliability, reducing processing cost, and supporting a payload longer than 12 digits.

V2 remains unchanged as the compatibility baseline. Existing v2 printed samples must continue to be tested with v2 and must not be invalidated by v3 development.

## 2. Target Layout

The initial target layout is:

```text
[ QR ] [ fixed gap ] [ one rectangular pattern ]
```

The pattern is placed consistently on the **right side of the QR**.

### Layout principles

- QR is the geometric anchor.
- Only one rectangular pattern is decoded.
- The pattern crop is deterministic from the QR geometry.
- The QR value is not treated as a unique pattern identity.
- No left/right candidate search is used in the main v3 path.
- Crop geometry must be measured and covered by regression tests.
- The layout receives an explicit version identifier: `v3`.

## 3. Scope Boundaries

### In scope

- V3 payload format and capacity design.
- One-pattern matrix and decoder.
- QR-right-pattern renderer.
- V3 generator preview and export.
- QR-anchored web verifier.
- Camera responsiveness and lifecycle control.
- Optional multi-frame recovery for one active pattern.
- Backward-compatible API integration.
- Digital, synthetic, and physical sample testing.

### Out of scope until explicitly approved

- Changes to v2 generator or verifier.
- Changes to already printed v2 samples.
- Mobile implementation.
- Unbounded candidate-search loops.
- Automatic lens switching.
- Replacing validated v2 contracts without a new v3 test.

## 4. Development Rules

1. Read the current v3 implementation before editing.
2. Keep v2 and v3 changes isolated.
3. Define or update a contract before implementing dependent code.
4. Add a focused test for every matrix, geometry, or payload behavior change.
5. Do not rely on QR content as pattern identity.
6. Do not promote cached payloads as current-frame data.
7. Process camera frames serially; skip frames while decoding is busy.
8. Avoid expensive debug image generation during normal scanning.
9. Do not print physical batches before digital and single-sample validation pass.
10. Record decisions, test results, and known limitations in this document.

## 5. Milestones and Gates

### Phase 0 — Freeze Scope and Contracts

**Goal:** finalize the layout and payload decisions before coding.

Decisions required:

- QR dimensions and quiet zone.
- Pattern dimensions and aspect ratio.
- Fixed QR-to-pattern gap.
- Overall output dimensions and margins.
- Maximum payload length.
- Supported character set.
- Padding rules.
- Checksum/error-correction strategy.
- V3-only or backward-compatible verifier behavior.

**Deliverables:**

- Layout contract.
- Payload contract.
- Example payloads, including maximum-length payload.
- Explicit `layout_version: v3`.

### Confirmed initial requirements

- QR visual size remains the same as v2.
- The rectangular pattern keeps the same visual dimensions and appearance as v2.
- Downloaded output must remain high-resolution and suitable for physical printing.
- The QR-to-pattern gap is one white module/space, derived from the QR module size rather than hard-coded pixels.
- Payload capacity is exactly 24 characters.
- The allowed character set is `A-Z`, `a-z`, `0-9`, `-`, and `_`.
- Payload characters use a 6-bit alphabet encoding; lowercase is preserved.
- Payload format uses a version byte, explicit length byte, 24-character data capacity, CRC-16 integrity validation, and Reed–Solomon error correction.
- The protected codeword target is 32 bytes: 22 bytes of data plus 10 bytes of Reed–Solomon correction.
- The V3 matrix contract is 64 rows × 32 columns, matching the v2 rectangular visual ratio and providing 2,048 carrier cells for deterministic spreading.
- Matrix decoding must reject invalid version, length, character set, CRC, or uncorrectable Reed–Solomon data.
- Bit spreading/repetition and Reed–Solomon correction are complementary: neither may be treated as a substitute for the other.
- The payload format is platform-neutral and must be implementable without a third-party Reed–Solomon dependency in TypeScript, Dart, Kotlin, and Swift.
- The normative byte-level contract is documented in `docs/V3_PAYLOAD_FORMAT.md`.
- Shared JSON fixtures will be generated only from the final independent implementation; placeholder codewords are not accepted.
- The V3 verifier is V3-only; V1/V2 compatibility is out of scope for the V3 primary verifier.
- The web verifier targets modern desktop browsers and mobile browsers on Android and iOS.
- Future native Android and iOS verifiers are separate follow-up projects using the V3 contract.
- The physical test range is total printed pattern height from 7 mm down to 1.1 mm.

**Gate:** the payload and matrix contract is locked. Implementation may begin, but renderer and physical-print gates must still prove geometry, sampling reliability, and browser/device behavior.

### Phase 1 — Payload Encoding and Validation

**Goal:** encode and decode payloads longer than 12 digits deterministically.

Required behavior:

- Validate empty, short, normal, maximum, and oversized input.
- Preserve payload length.
- Define character encoding and padding.
- Detect malformed payloads.
- Validate checksum/error correction.

**Deliverables:**

- V3 payload encoder.
- V3 payload decoder.
- Capacity validation.
- Round-trip tests.
- Corruption and invalid-input tests.

**Gate:** **Passed (2026-08-26).** All valid fixtures pass encode → decode exactly; the codec applies Reed–Solomon correction before structural and CRC validation; one-to-five byte corruption is recovered and six-byte corruption is rejected. The deterministic fixtures were also checked against the ZXing Reed–Solomon reference parameters. Remaining cross-platform Dart/Kotlin/Swift checks are implementation acceptance work, not a blocker for the TypeScript Phase 1 gate.

### Phase 2 — Matrix and Local Decoder *(complete for deterministic local codec)*

**Goal:** prove the one-pattern format without camera variables.

Required behavior:

- Generate the V3 matrix.
- Apply deterministic mask and bit distribution.
- Decode the matrix without a camera.
- Detect checksum errors.
- Measure recovery under controlled bit noise.

**Deliverables:**

- V3 matrix encoder.
- V3 matrix decoder.
- Matrix round-trip test.
- Noise and corruption test.
- Capacity test.

**Current implementation (2026-08-27):** `lib/cdp/v3-matrix.ts` implements a deterministic 64 × 32 carrier matrix. Each of the 256 codeword bits is distributed across eight carrier cells using a coprime step of 17 modulo 256 and a deterministic reversible mask. The local decoder validates dimensions and cell values, votes repeated carriers, then delegates codeword validation and Reed–Solomon/CRC recovery to the Phase 1 codec. Initial round-trip, deterministic-output, five-cell corruption, and invalid-input tests pass.

**Gate:** **Passed for the deterministic local codec (2026-08-27).** The 64 × 32 matrix round-trips empty, short, normal, and maximum payloads; deterministic output is stable; controlled carrier corruption is recovered through repetition voting and the Phase 1 RS/CRC validation; invalid dimensions, cell values, alphabet, and capacity are rejected. Camera/image sampling, geometric transforms, and physical noise remain Phase 5/10 acceptance tests.

### Phase 3 — V3 Renderer *(complete)*

**Goal:** render a stable QR-plus-right-pattern image.

Required layout:

```text
+----------+------+------------------+
|          |      |                  |
|    QR    | gap  |    Pattern       |
|          |      |                  |
+----------+------+------------------+
```

Test and preserve:

- QR position and dimensions.
- Pattern position and dimensions.
- Fixed gap.
- Quiet zones and margins.
- Output dimensions.
- Pixel preservation.
- Deterministic rendering.

**Deliverables:**

- V3 renderer.
- Layout measurement test.
- Pixel/layout regression test.
- Digital sample images.

**Current implementation (2026-08-27):** Added the dedicated `v3-qr-pattern` renderer and measurable layout metadata. The QR is placed first, the pattern is placed only on the right, the gap is derived from the QR module size, and both elements are vertically centered within the content area. The output includes a measured white right margin so the pattern does not touch the saved canvas edge. `components/generator/PreviewModal.tsx` and the main generator workflow use the V3 payload codec, 64 × 32 V3 matrix, and single-pattern renderer; the legacy two-pattern composition is no longer used by the V3 path. Geometry, canvas-dimension, right-margin pixel, and focused end-to-end render regression tests pass.

**Gate:** **Passed for the implemented V3 renderer contract (2026-08-27).** Layout coordinates, dimensions, QR-module gap, measured right margin, white edge preservation, and deterministic rendering are covered by regression tests. Browser/device and physical-print acceptance remain later Phase 5/10 work.

### Phase 4 — V3 Generator

**Goal:** connect payload encoding, matrix generation, QR generation, and rendering.
Required behavior:

- Accept payloads above 12 digits up to the approved capacity.
- Reject oversized or invalid payloads clearly.
- Show a faithful preview.
- Export/print without geometry changes.
- Include V3 layout metadata.
- Work offline where the product requirement requires it.

**Deliverables:**

- Generator controls.
- Preview.
- Export/print flow.
- Generator tests.
- Sample fixture set.

**Current implementation (2026-08-27):** The V3 generator workflow is connected end-to-end for single generation and batch generation. It validates the 24-character V3 contract, renders the QR-plus-right-pattern layout, preserves the same renderer for preview/download/save, and writes V3 layout metadata without a second semantic payload. The batch path no longer invokes the legacy 12-character encryption workflow. A maximum-length generator contract test verifies payload → matrix → local decoder round-trip.

**Gate:** **Passed for the local digital generator contract (2026-08-27).** Maximum-length and invalid-payload contract tests pass, the complete V3 regression suite passes, and TypeScript reports no errors in the changed generator/renderer/test files. Browser/device and physical-print acceptance remain later phases.

### Phase 5 — QR-Anchored V3 Web Decoder

**Goal:** detect QR and decode only the pattern to its right.

Processing flow:

```text
Capture current frame
→ detect QR
→ determine QR orientation and scale
→ calculate fixed right-pattern bounds
→ crop one pattern
→ normalize one patter
→ decode payload
→ validate checksum
```

Required behavior:

- Use current-frame pixels only.
- Use QR geometry, not QR value, for crop placement.
- Keep candidate offsets bounded and measurable.
- Return debug bounds and confidence.
- Do not run v2 two-sided decoding in the primary v3 path.
- Reset state when QR disappears or geometry changes materially.

**Deliverables:**

- V3 QR anchor detector.
- Pattern crop calculator.
- Pattern decoder integration.
- Debug overlay/capture support.
- Synthetic transform tests.

**Current implementation (2026-08-31):** `hooks/useVerifyScanner.ts` implements the QR-anchored flow. ZXing is configured QR-only with `TRY_HARDER` and no `PURE_BARCODE` hint key — the installed ZXing enables pure mode on key presence even with a `false` value, which silently disabled camera detection and was the root cause of the persistent "QR belum" state. A QR-focused left-region input with a synthetic white quiet zone is used as a fallback attempt when the full-ROI decode fails. Finder points are ordered into a top-left/top-right/bottom-left anchor, expanded by 3.5 modules to the 25-module symbol edge, and the right pattern is cropped with the renderer's exact geometry: pattern height equals the QR symbol height (25 modules), gap equals two modules (one QR quiet-zone module plus one layout gap module), and bounded ±0.5/±1-module correction candidates are tried when the exact crop fails checksum. Crops are exposed for debugging even when the current frame's RS/CRC validation fails, and the primary renderer-derived geometry — not the last search candidate — is what gets displayed. Capture remains capped at 960 px for performance.

**Remaining acceptance work:** device validation of cale/rotation/blur/contrast/noise tolerance, synthetic transform tests, and confidence reporting from actual sampling quality instead of the current constant value.

**Gate:** digital samples pass with scale changes, small rotation, crop offset, blur, contrast changes, and moderate noise.

### Phase 6 — Camera Control and Performance

**Goal:** keep the browser responsive while scanning.

Required behavior:

- One active camera stream.
- Rear camera requested without unwanted lens switching.
- Continuous focus when supported.
- Manual torch only when supported.
- Manual zoom only when supported and responsive.
- Serial frame processing with backpressure.
- Cancellation/session guard for stale async work.
- Cleanup on unmount, retry, and camera lifecycle changes.r

Performance rules:

- Reuse canvases where practical.
- Do not call `toDataURL()` on every frame in normal mode.
- Do not create composite evidence images until needed.
- Do not run expensive legacy decoding when V3 QR detection has succeeded.
- Keep debug mode explicit and disabled by default.
- Measure decode duration before changing scan frequency.

**Gate:** preview, buttons, zoom controls, and page interactions remain responsive during detection.

### Phase 7 — Multi-Frame Recovery

**Goal:** recover a valid payload from short-lived camera noise without mixing patterns.

Required behavior:

- Keep history for one active pattern only.
- Reset on QR loss, geometry change, camera restart, or explicit reset.
- Limit history length.
- Never use cached payload text as current-frame evidence.
- Accept only a checksum-valid recovered payload.
- Ensure A → Z never returns A.

**Gate:** repeated physical pattern-switch tests pass in both directions.

### Phase 8 — API and Database Integration

**Goal:** verify V3 without breaking existing contracts.

Required metadata:

- `layout_version: v3-qr-pattern`
- `payload_mode: three-part` (shared enum; V3 uses a single pattern payload)
- `pattern_side: right`
- `payload_length`
- `checksum_valid`

**Current implementation (2026-08-31):** The verify API (`app/api/verify/route.ts`) accepts `layout_version: v3-qr-pattern`, validates the V3 payload shape (1–24 characters of `A-Z a-z 0-9 - _`), looks it up by serial in `pattern_generated_v21`, and returns AUTHENTIC/COUNTERFEIT without decryption. The client submits `pattern_decode_payload` as the V3 payload with empty left/right chunk fields; `verdictSource` reports `qr-anchor-v3`. Legacy v2.1 and encrypted-payload paths are unchanged.

Required behavior:

- Preserve v2 API behavior.
- Validate payload length server-side.
- Avoid truncating long payloads.
- Use consistent error responses.
- Use backward-compatible schema evolution.
- Keep authorization and audit behavior unchanged.

**Gate:** V3 scanner → API → database/result flow succeeds for valid and invalid samples.

### Phase 9 — Test Matrix

#### Unit tests

- Payload encode/decode.
- Capacity limits.
- Padding and character validation.
- Checksum/error correction.
- Matrix round-trip.
- Invalid and corrupted data.

#### Render tests

- QR size and position.
- Pattern size and position.
- Fixed gap.
- Output dimensions.
- Pixel preservation.
- Determinism.

#### Decoder tests

- Scale changes.
- Small rotation.
- Crop offset.
- Blur.
- Brightness and contrast.
- Noise.
- Mild perspective.
- Missing/invalid QR.
- Pattern changes with identical QR.

#### Browser/device tests

- Desktop webcam.
- Android Chrome.
- iPhone Safari.
- Bright light.
- Low light.
- Reflection.
- Near and far distances.
- Manual zoom support and unsupported devices.
- A → Z → A switching.

**Gate:** failures are classified as code, contract, device, environment, or external-service failures before fixes are made.

### Phase 10 — Physical Sample Pilot and Freeze

Order:

1. Validate digital samples.
2. Print one or a very small pilot set.
3. Test desktop browser.
4. Test Android browser.
5. Test iPhone browser.
6. Test lighting, distance, angle, and reflection.
7. Record debug captures and results.
8. Adjust only through a documented contract change.
9. Print the next batch only after the pilot passes.
10. Freeze V3 layout and payload contracts.

## 6. Proposed Work Sequence

```text
1. Freeze layout contract
2. Freeze payload contract
3. Implement payload encoder/decoder
4. Implement matrix and local decoder
5. Add round-trip and corruption tests
6. Implement V3 renderer
7. Add render regression tests
8. Implement V3 generator
9. Validate digital samples
10. Implement QR-right-pattern web decoder
11. Optimize camera lifecycle and scheduling
12. Add bounded multi-frame recovery
13. Integrate API and database metadata
14. Run browser/device tests
15. Run physical pilot
16. Freeze V3
```

## 7. Decision Log

| Date | Decision | Reason | Impact |
|---|---|---|---|
| 2026-08-26 | V3 uses v2 as a separate baseline | Preserve v2 behavior and printed samples | No v2 files should be changed for V3 work |
| 2026-08-26 | One rectangular pattern is placed to the right of QR | Simplify crop and reduce decoder workload | Primary decoder only searches the right side |
| 2026-08-26 | V3 must support payloads longer than 12 digits | Expand practical payload capacity | New payload contract is required |
| 2026-08-26 | QR content is not a unique pattern identity | Multiple printed patterns can share QR data | No QR-only cache/history identity |
| 2026-08-26 | QR size and pattern visual style follow v2 | Preserve proven visual dimensions and high-resolution print output | V3 changes layout position/capacity, not the visual pattern style |
| 2026-08-26 | Pattern is separated from QR by one white module | Match the intended QR `1:1:3:1:1` module rhythm | Gap is calculated from QR module size |
| 2026-08-26 | Capacity target is 20–24 characters | Support longer identifiers with the same visual pattern | Capacity must be proven by local, render, and print tests |
| 2026-08-26 | V3 verifier is V3-only | Avoid mixed-format detection paths | V1/V2 compatibility is excluded from the V3 verifier |
| 2026-08-26 | Web target includes desktop, Android, and iOS browsers | Support broad browser usage | Camera behavior requires cross-browser testing |
| 2026-08-26 | Total printed pattern height is tested from 7 mm to 1.1 mm | Measure the usable physical detection range | Print pilot must test every selected size |
| 2026-08-26 | Final payload capacity is 24 characters | Support the requested longer identifier | Matrix capacity and correction overhead must be proven |
| 2026-08-26 | Allowed payload characters are letters, digits, `-`, and `_`, including lowercase | Preserve flexibility while keeping a bounded alphabet | Encoder must reject all other characters |
| 2026-08-26 | Payload length is explicit and padding is not semantically significant | Avoid ambiguity caused by trailing spaces | Decoder trims only structural padding after length validation |
| 2026-08-26 | QR and pattern have equal visual height | Keep the printed layout balanced | Renderer and geometry tests must enforce equal height |
| 2026-08-26 | Native zoom is supported when available and must not force lens switching | Improve readability of small physical samples | Use v1-compatible zoom constraints and cross-browser fallback |

## 8. Open Decisions

These must be resolved before Phase 1 is considered complete:

- [ ] Confirm exact v2 QR dimensions and quiet-zone policy.
- [x] Matrix is locked at 64 rows × 32 columns to preserve the v2 rectangular visual ratio and carrier density.
- [x] Gap is one QR module, specifically one white module after the QR boundary.
- [x] Export uses high-resolution lossless PNG with dimensions derived from the generated pattern.
- [x] Final payload capacity is 24 characters.
- [x] Allowed characters are alphabetic characters, digits, `-`, and `_`; lowercase is accepted.
- [x] Padding uses an explicit payload length field; no trailing spaces are required for decoding.
- [x] Initial integrity contract is CRC-16 plus Reed–Solomon with 10 correction bytes; corruption tests remain mandatory to verify the selected implementation and thresholds.
- [x] V3-only primary verifier.
- [x] Physical test range is total printed pattern height from 7 mm down to 1.1 mm.
- [ ] Validate desktop, Android Chrome, iOS Safari, and other supported browsers.
- [ ] Define HTTPS/local deployment and clear camera-permission fallback behavior.
- [x] Define a platform-neutral payload format for web and future Flutter/Android/iOS verifiers.
- [x] Remove the requirement for a platform-specific Reed–Solomon package.
- [ ] Implement and verify independent Reed–Solomon encoder/decoder.
- [x] Generate initial canonical cross-platform payload test vectors; promote them to normative only after independent implementations reproduce them.

## 9. Progress Checklist

- [x] Phase 0 — Scope and contracts
- [ ] Phase 1 — Payload encoding (portable contract and independent ECC pending)
- [ ] Phase 2 — Matrix and local decoder
- [x] Phase 3 — Renderer
- [x] Phase 4 — Generator
- [ ] Phase 5 — QR-anchored decoder
- [ ] Phase 6 — Camera performance
- [ ] Phase 7 — Multi-frame recovery
- [ ] Phase 8 — API/database integration
- [ ] Phase 9 — Test matrix
- [ ] Phase 10 — Physical pilot and freeze

## 10. Change Record

Record every implementation change that affects the V3 contract or detection behavior here.

| Date | Files | Change | Validation | Result |
|---|---|---|---|---|
|  |  |  |  |  |
