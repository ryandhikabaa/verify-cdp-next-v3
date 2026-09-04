import assert from 'node:assert/strict';
import test from 'node:test';
import {HvalueValidationError, validateHvalue} from '../lib/cdp/hvalue';

test('accepts 1-7 alphanumeric hvalues without changing case', () => {
  assert.equal(validateHvalue('TELKOM'), 'TELKOM');
  assert.equal(validateHvalue('Telkom'), 'Telkom');
  assert.equal(validateHvalue(' a1Z9x '), 'a1Z9x');
  assert.equal(validateHvalue('A'), 'A');
  assert.equal(validateHvalue('1234567'), '1234567');
});

test('rejects empty, too long, and non-alphanumeric hvalues before any API call', () => {
  assert.throws(() => validateHvalue(''), HvalueValidationError);
  assert.throws(() => validateHvalue('   '), HvalueValidationError);
  assert.throws(() => validateHvalue(null), HvalueValidationError);
  assert.throws(() => validateHvalue('TELKOM12'), (error: unknown) => error instanceof HvalueValidationError && error.code === 'too_long');
  assert.throws(() => validateHvalue('TEL-KOM'), (error: unknown) => error instanceof HvalueValidationError && error.code === 'alphabet');
  assert.throws(() => validateHvalue('TEL KOM'), HvalueValidationError);
});
