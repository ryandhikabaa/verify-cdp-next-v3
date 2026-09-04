const HVALUE_ALPHABET = /^[A-Za-z0-9]+$/;
const HVALUE_MIN_LENGTH = 1;
const HVALUE_MAX_LENGTH = 7;

export class HvalueValidationError extends Error {
  readonly code: 'required' | 'too_long' | 'alphabet';

  constructor(code: HvalueValidationError['code'], message: string) {
    super(message);
    this.name = 'HvalueValidationError';
    this.code = code;
  }
}

export function hvalueErrorMessage(code: HvalueValidationError['code']) {
  if (code === 'required') return 'Hidden value wajib diisi.';
  if (code === 'too_long') return 'Hidden value maksimal 7 karakter.';
  return 'Hidden value hanya boleh huruf atau angka.';
}

/** Validates operator hvalue: trimmed, 1–7 chars, A-Z a-z 0-9, no silent truncate. */
export function validateHvalue(value: unknown) {
  if (typeof value !== 'string') {
    throw new HvalueValidationError('required', hvalueErrorMessage('required'));
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new HvalueValidationError('required', hvalueErrorMessage('required'));
  }
  if (trimmed.length > HVALUE_MAX_LENGTH) {
    throw new HvalueValidationError('too_long', hvalueErrorMessage('too_long'));
  }
  if (trimmed.length < HVALUE_MIN_LENGTH || !HVALUE_ALPHABET.test(trimmed)) {
    throw new HvalueValidationError('alphabet', hvalueErrorMessage('alphabet'));
  }

  return trimmed;
}
