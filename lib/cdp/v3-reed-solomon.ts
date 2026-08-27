const FIELD_SIZE = 256;
const PRIMITIVE = 0x11d;
const PARITY_BYTES = 10;
const EXP = new Uint16Array(510);
const LOG = new Int16Array(FIELD_SIZE);
let x = 1;
for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= PRIMITIVE; }
for (let i = 255; i < EXP.length; i++) EXP[i] = EXP[i - 255];
const mul = (a: number, b: number) => a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
const inv = (a: number) => { if (!a) throw new Error('RS inverse zero.'); return EXP[255 - LOG[a]]; };
const div = (a: number, b: number) => a === 0 ? 0 : mul(a, inv(b));
const pow = (a: number, n: number) => a === 0 ? 0 : EXP[(LOG[a] * n) % 255];
class P {
  constructor(readonly c: number[]) { while (this.c.length > 1 && this.c[0] === 0) this.c.shift(); }
  get d() { return this.c.length - 1; }
  get z() { return this.c.length === 1 && this.c[0] === 0; }
  at(d: number) { return this.c[this.c.length - 1 - d] ?? 0; }
  eval(v: number) { let r = 0; for (const a of this.c) r = mul(r, v) ^ a; return r; }
  add(p: P) { const a = this.c.length >= p.c.length ? this.c : p.c; const b = this.c.length >= p.c.length ? p.c : this.c; const out = a.slice(); const off = a.length - b.length; for (let i = 0; i < b.length; i++) out[i + off] ^= b[i]; return new P(out); }
  mul(p: P) { if (this.z || p.z) return new P([0]); const out = new Array(this.c.length + p.c.length - 1).fill(0); for (let i = 0; i < this.c.length; i++) for (let j = 0; j < p.c.length; j++) out[i + j] ^= mul(this.c[i], p.c[j]); return new P(out); }
  scalar(a: number) { return a ? new P(this.c.map(v => mul(v, a))) : new P([0]); }
  mono(d: number, a: number) { return a ? new P([...this.c.map(v => mul(v, a)), ...new Array(d).fill(0)]) : new P([0]); }
}
const ZERO = new P([0]);
const ONE = new P([1]);
let GENERATOR = ONE;
for (let i = 0; i < PARITY_BYTES; i++) GENERATOR = GENERATOR.mul(new P([1, pow(2, i)]));
export function reedSolomonEncode(data: Uint8Array) { const out = new Uint8Array(data.length + PARITY_BYTES); out.set(data); for (let i = 0; i < data.length; i++) { const f = out[i]; if (f) for (let j = 0; j < GENERATOR.c.length; j++) out[i + j] ^= mul(GENERATOR.c[j], f); } out.set(data); return out; }
function syndromes(bytes: Uint8Array) { const p = new P(Array.from(bytes)); const s = new Array(PARITY_BYTES).fill(0); let clean = true; for (let i = 0; i < PARITY_BYTES; i++) { const v = p.eval(pow(2, i)); s[PARITY_BYTES - i - 1] = v; if (v) clean = false; } return {s, clean}; }
function euclid(a: P, b: P): [P, P] { if (a.d < b.d) [a, b] = [b, a]; let oldT = ZERO, t = ONE; while (b.d >= PARITY_BYTES / 2) { const lastA = a, lastT = t; let r = a, q = ZERO; const scale = inv(b.at(b.d)); while (!r.z && r.d >= b.d) { const dd = r.d - b.d; const k = mul(r.at(r.d), scale); q = q.add(new P([k]).mono(dd, 1)); r = r.add(b.mono(dd, k)); } t = q.mul(t).add(oldT); a = b; b = r; oldT = lastT; } const k = inv(t.at(0)); return [t.scalar(k), b.scalar(k)]; }
function locations(locator: P) { if (locator.d === 1) return [locator.at(1)]; const out: number[] = []; for (let i = 1; i < 256 && out.length < locator.d; i++) if (locator.eval(i) === 0) out.push(inv(i)); if (out.length !== locator.d) throw new Error('RS locator roots mismatch.'); return out; }
function magnitudes(evaluator: P, locs: number[]) { return locs.map((loc, i) => { const li = inv(loc); let den = 1; for (let j = 0; j < locs.length; j++) if (i !== j) den = mul(den, (mul(locs[j], li) ^ 1)); return div(evaluator.eval(li), den); }); }
export function reedSolomonDecode(input: Uint8Array): {codeword: Uint8Array; correctedBytes: number} { const initial = syndromes(input); if (initial.clean) return {codeword: input.slice(), correctedBytes: 0}; const [locator, evaluator] = euclid(new P([1, ...new Array(PARITY_BYTES).fill(0)]), new P(initial.s)); const locs = locations(locator); const mags = magnitudes(evaluator, locs); const out = input.slice(); for (let i = 0; i < locs.length; i++) { const pos = out.length - 1 - LOG[locs[i]]; if (pos < 0) throw new Error('RS position invalid.'); out[pos] ^= mags[i]; } if (!syndromes(out).clean) throw new Error('RS correction verification failed.'); return {codeword: out, correctedBytes: locs.length}; }
