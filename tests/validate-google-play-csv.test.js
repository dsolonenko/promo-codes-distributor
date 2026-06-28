import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { extractCodesFromText } from '../lib/csv.js';

test('Validate Google Play CSV File Integration (Self-Contained)', () => {
  // Create a temporary mock CSV file simulating Google Play's format
  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, 'mock_promotion_codes.csv');
  
  const mockCsvContent = `Promotion code
7MXDUQM3J6ELZ9EZKQ6KXJ4
HWS3CM3YQYVHQP9U2AXH3QG
F7QJS1WPYHBZHE5TS4TSMYX
RKDB937Z52UE5D2DFPE0X1N
H2KE4FV5H3X6K5AZUV36TU8
`;

  // Write mock file to disk
  fs.writeFileSync(filePath, mockCsvContent, 'utf8');

  try {
    // Read the mock file back from disk to verify file system integration
    const csvContent = fs.readFileSync(filePath, 'utf8');
    const codes = extractCodesFromText(csvContent);

    // Verify correct parsing of mock data
    assert.strictEqual(codes.length, 5, 'Should parse exactly 5 codes from the mock CSV file.');
    assert.deepStrictEqual(codes, [
      '7MXDUQM3J6ELZ9EZKQ6KXJ4',
      'HWS3CM3YQYVHQP9U2AXH3QG',
      'F7QJS1WPYHBZHE5TS4TSMYX',
      'RKDB937Z52UE5D2DFPE0X1N',
      'H2KE4FV5H3X6K5AZUV36TU8'
    ]);

    // Structural validations
    for (const code of codes) {
      assert.ok(code.length >= 8 && code.length <= 30, `Code "${code}" must have length between 8 and 30.`);
      assert.match(code, /^[A-Z0-9_\-]+$/i, `Code "${code}" contains invalid characters.`);
      assert.ok(!code.includes(' '), `Code "${code}" contains whitespace.`);
    }

  } finally {
    // Clean up temporary file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});
