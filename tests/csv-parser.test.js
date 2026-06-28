import test from 'node:test';
import assert from 'node:assert';
import { extractCodesFromText } from '../lib/csv.js';

test('CSV Parser - Google Play CSV Format', () => {
  const csvContent = `Promotion code
7MXDUQM3J6ELZ9EZKQ6KXJ4
HWS3CM3YQYVHQP9U2AXH3QG
F7QJS1WPYHBZHE5TS4TSMYX
`;

  const result = extractCodesFromText(csvContent);
  
  assert.deepStrictEqual(result, [
    '7MXDUQM3J6ELZ9EZKQ6KXJ4',
    'HWS3CM3YQYVHQP9U2AXH3QG',
    'F7QJS1WPYHBZHE5TS4TSMYX'
  ]);
});

test('CSV Parser - Comma Separated Columns with Headers', () => {
  const csvContent = `Promo Code,Status,Date
CODE-XYZ-123,Active,2026-06-28
CODE-ABC-456,Active,2026-06-28
`;

  const result = extractCodesFromText(csvContent);
  
  assert.deepStrictEqual(result, [
    'CODE-XYZ-123',
    'CODE-ABC-456'
  ]);
});

test('CSV Parser - Pasted Plain Text (One Per Line)', () => {
  const rawContent = `
    MYTESTCODE12345
    MYTESTCODE67890
    
    ANOTHERCODE9999
  `;

  const result = extractCodesFromText(rawContent);
  
  assert.deepStrictEqual(result, [
    'MYTESTCODE12345',
    'MYTESTCODE67890',
    'ANOTHERCODE9999'
  ]);
});

test('CSV Parser - Filter Blacklisted Headers', () => {
  const headers = `
    Code
    Promo
    Promo_Code
    Promotion-Code
    Promotion
  `;

  const result = extractCodesFromText(headers);
  assert.deepStrictEqual(result, []);
});

test('CSV Parser - Skip Too Short or Invalid Codes', () => {
  const content = `
    SHORT
    123
    VALIDCODE12345
    INVALID@CHARACTER
  `;

  const result = extractCodesFromText(content);
  assert.deepStrictEqual(result, ['VALIDCODE12345']);
});

test('CSV Parser - Duplicate Code Deduplication', () => {
  const content = `
    DUPCODE12345
    DUPCODE12345
    NEWCODE12345
  `;

  const result = extractCodesFromText(content);
  assert.deepStrictEqual(result, ['DUPCODE12345', 'NEWCODE12345']);
});
