import test from 'node:test';
import assert from 'node:assert';
import { db } from '../lib/db.js';
import { 
  uploadCodesLogic, 
  claimCodeLogic, 
  getStatsLogic, 
  getClaimedCodesLogic, 
  clearCampaignLogic 
} from '../lib/logic.js';

// ============================================================================
// Database & Environment Setup Mock
// ============================================================================

let mockDb = [];

// Intercept database calls and simulate Postgres memory engine
test.mock.method(db, 'sql', async (strings, ...values) => {
  const query = strings.join('?').trim().replace(/\s+/g, ' ');

  // 1. Idempotency Check: SELECT code FROM promo_codes WHERE dist_slug = ? AND claimed_by_email = ? LIMIT 1
  if (query.includes('SELECT code FROM promo_codes WHERE dist_slug') && query.includes('claimed_by_email = ? LIMIT 1')) {
    const [dist, email] = values;
    const rows = mockDb.filter(r => r.dist_slug === dist && r.claimed_by_email === email);
    return { rowCount: rows.length, rows };
  }

  // 2. Concurrency Safety: UPDATE promo_codes SET claimed_by_email = ? WHERE id = (...) RETURNING code
  if (query.includes('UPDATE promo_codes SET') && query.includes('claimed_by_email = ?') && query.includes('RETURNING code')) {
    const [email, dist] = values;
    // Find first unclaimed code in this distribution pool
    const index = mockDb.findIndex(r => r.dist_slug === dist && r.claimed_by_email === null);
    if (index !== -1) {
      mockDb[index].claimed_by_email = email;
      mockDb[index].claimed_at = new Date().toISOString();
      return { rowCount: 1, rows: [mockDb[index]] };
    }
    return { rowCount: 0, rows: [] };
  }

  // 3. Admin: GET Stats (Grouped by dist_slug)
  if (query.includes('SELECT dist_slug') && query.includes('COUNT(*)') && query.includes('GROUP BY dist_slug')) {
    const groups = {};
    mockDb.forEach(r => {
      if (!groups[r.dist_slug]) {
        groups[r.dist_slug] = { dist_slug: r.dist_slug, total: 0, claimed: 0, remaining: 0 };
      }
      groups[r.dist_slug].total++;
      if (r.claimed_by_email) {
        groups[r.dist_slug].claimed++;
      } else {
        groups[r.dist_slug].remaining++;
      }
    });
    return { rows: Object.values(groups) };
  }

  // 4. Admin: GET Claim Log for a specific distribution
  if (query.includes('SELECT code, claimed_by_email, claimed_at FROM promo_codes WHERE dist_slug')) {
    const [dist] = values;
    const rows = mockDb.filter(r => r.dist_slug === dist && r.claimed_by_email !== null);
    return { rows };
  }

  // 5. Admin: POST Bulk insert codes
  if (query.includes('INSERT INTO promo_codes') && query.includes('ON CONFLICT (code) DO NOTHING')) {
    const [codes, dist] = values;
    let inserted = 0;
    codes.forEach(code => {
      if (!mockDb.some(r => r.code === code)) {
        mockDb.push({
          id: mockDb.length + 1,
          code,
          dist_slug: dist,
          claimed_by_email: null,
          claimed_at: null
        });
        inserted++;
      }
    });
    return { rowCount: inserted };
  }

  // 6. Admin: DELETE Reset campaign distribution
  if (query.includes('DELETE FROM promo_codes WHERE dist_slug')) {
    const [dist] = values;
    mockDb = mockDb.filter(r => r.dist_slug !== dist);
    return { rowCount: 1 };
  }

  throw new Error(`Unhandled mock query: ${query}`);
});

// Configure developer whitelisted emails env variable
process.env.DEVELOPER_EMAILS = 'admin@example.com';

// ============================================================================
// Functional E2E Test Scenarios
// ============================================================================

test('Functional E2E - Campaign Upload, Claiming Pipeline, and Reset', async () => {
  // Clear mock DB on start
  mockDb = [];

  const adminEmail = 'admin@example.com';
  const user1Email = 'tester1@example.com';
  const user2Email = 'tester2@example.com';
  const campaign = 'alpha-campaign-1';

  // --------------------------------------------------------------------------
  // 1. Upload Codes (Admin)
  // --------------------------------------------------------------------------
  const uploadResult = await uploadCodesLogic(
    adminEmail, 
    campaign, 
    ['ALPHAC1CODE1', 'ALPHAC1CODE2', 'ALPHAC1CODE3']
  );
  
  assert.strictEqual(uploadResult.success, true);
  assert.strictEqual(uploadResult.count, 3);
  assert.strictEqual(mockDb.length, 3);

  // Assert upload permissions (Non-admin should fail)
  await assert.rejects(
    async () => {
      await uploadCodesLogic(user1Email, campaign, ['SOME_CODE']);
    },
    /Forbidden/
  );

  // --------------------------------------------------------------------------
  // 2. Fetch Dashboard Statistics
  // --------------------------------------------------------------------------
  const statsResult = await getStatsLogic(adminEmail);
  assert.deepStrictEqual(statsResult.stats, [
    { dist_slug: 'alpha-campaign-1', total: 3, claimed: 0, remaining: 3 }
  ]);

  // Assert stats permissions (Non-admin should fail)
  await assert.rejects(
    async () => {
      await getStatsLogic(user1Email);
    },
    /Forbidden/
  );

  // --------------------------------------------------------------------------
  // 3. Tester 1 Claims Code
  // --------------------------------------------------------------------------
  const claim1Result = await claimCodeLogic(user1Email, campaign);
  assert.strictEqual(claim1Result.code, 'ALPHAC1CODE1', 'Tester 1 should be allocated the first code.');

  // --------------------------------------------------------------------------
  // 4. Tester 1 Claims Again (Idempotency Verification)
  // --------------------------------------------------------------------------
  const claimDuplicateResult = await claimCodeLogic(user1Email, campaign);
  assert.strictEqual(claimDuplicateResult.code, 'ALPHAC1CODE1', 'Tester 1 should get the exact same code.');

  // --------------------------------------------------------------------------
  // 5. Tester 2 Claims Code (Allocation Progress Verification)
  // --------------------------------------------------------------------------
  const claim2Result = await claimCodeLogic(user2Email, campaign);
  assert.strictEqual(claim2Result.code, 'ALPHAC1CODE2', 'Tester 2 should get the second code.');

  // Verify DB counters
  const stats2Result = await getStatsLogic(adminEmail);
  assert.deepStrictEqual(stats2Result.stats, [
    { dist_slug: 'alpha-campaign-1', total: 3, claimed: 2, remaining: 1 }
  ]);

  // --------------------------------------------------------------------------
  // 6. Check Distribution Log
  // --------------------------------------------------------------------------
  const logResult = await getClaimedCodesLogic(adminEmail, campaign);
  assert.strictEqual(logResult.claims.length, 2);
  assert.strictEqual(logResult.claims[0].code, 'ALPHAC1CODE1');
  assert.strictEqual(logResult.claims[0].claimed_by_email, 'tester1@example.com');
  assert.strictEqual(logResult.claims[1].code, 'ALPHAC1CODE2');
  assert.strictEqual(logResult.claims[1].claimed_by_email, 'tester2@example.com');

  // Assert logs permissions (Non-admin should fail)
  await assert.rejects(
    async () => {
      await getClaimedCodesLogic(user1Email, campaign);
    },
    /Forbidden/
  );

  // --------------------------------------------------------------------------
  // 7. Purge Campaign
  // --------------------------------------------------------------------------
  const purgeResult = await clearCampaignLogic(adminEmail, campaign);
  assert.strictEqual(purgeResult.success, true);
  assert.strictEqual(mockDb.length, 0, 'Database should be empty after purge.');

  // Assert clear permissions (Non-admin should fail)
  await assert.rejects(
    async () => {
      await clearCampaignLogic(user1Email, campaign);
    },
    /Forbidden/
  );
});
