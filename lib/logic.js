import { db } from './db.js';

// Helper to verify if email is developer
function isDeveloper(email) {
  if (!email) return false;
  const devEmails = (process.env.DEVELOPER_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase());
  return devEmails.includes(email.toLowerCase());
}

/**
 * Business Logic: Claim code atomically with idempotency checks
 */
export async function claimCodeLogic(email, dist) {
  if (!email) throw new Error('Unauthorized');
  
  const campaignSlug = dist ? String(dist).trim() : 'default';

  // 1. Idempotency Check: Return existing code if user already has one for this campaign
  const checkRes = await db.sql`
    SELECT code FROM promo_codes 
    WHERE dist_slug = ${campaignSlug} AND claimed_by_email = ${email} 
    LIMIT 1
  `;
  
  if (checkRes.rowCount > 0) {
    return { code: checkRes.rows[0].code };
  }

  // 2. Concurrency Safety: Atomic pull & lock via FOR UPDATE SKIP LOCKED
  const claimRes = await db.sql`
    UPDATE promo_codes
    SET 
        claimed_by_email = ${email}, 
        claimed_at = NOW()
    WHERE id = (
        SELECT id 
        FROM promo_codes 
        WHERE dist_slug = ${campaignSlug} AND claimed_by_email IS NULL 
        ORDER BY id ASC
        FOR UPDATE SKIP LOCKED 
        LIMIT 1
    )
    RETURNING code;
  `;

  if (claimRes.rowCount > 0) {
    return { code: claimRes.rows[0].code };
  }

  // Out of codes
  return { code: null };
}

/**
 * Business Logic: Get statistics grouped by distribution campaign
 */
export async function getStatsLogic(email) {
  if (!email || !isDeveloper(email)) {
    throw new Error('Forbidden: Developer privileges required.');
  }

  const statsRes = await db.sql`
    SELECT 
      dist_slug,
      COUNT(*)::INT as total,
      COUNT(claimed_by_email)::INT as claimed,
      (COUNT(*) - COUNT(claimed_by_email))::INT as remaining
    FROM promo_codes
    GROUP BY dist_slug
    ORDER BY dist_slug ASC;
  `;

  return { stats: statsRes.rows };
}

/**
 * Business Logic: Get claimed codes log
 */
export async function getClaimedCodesLogic(email, dist) {
  if (!email || !isDeveloper(email)) {
    throw new Error('Forbidden: Developer privileges required.');
  }

  const campaignSlug = dist || 'default';
  const listRes = await db.sql`
    SELECT code, claimed_by_email, claimed_at 
    FROM promo_codes 
    WHERE dist_slug = ${campaignSlug} AND claimed_by_email IS NOT NULL 
    ORDER BY claimed_at DESC;
  `;

  return { claims: listRes.rows };
}

/**
 * Business Logic: Bulk upload codes
 */
export async function uploadCodesLogic(email, dist, codes) {
  if (!email || !isDeveloper(email)) {
    throw new Error('Forbidden: Developer privileges required.');
  }

  const campaignSlug = dist ? String(dist).trim() : 'default';

  if (!Array.isArray(codes) || codes.length === 0) {
    throw new Error('Invalid payload: Expecting a non-empty array of codes.');
  }

  const MAX_CODES_PER_UPLOAD = 50_000;
  if (codes.length > MAX_CODES_PER_UPLOAD) {
    throw new Error(`Invalid payload: Cannot upload more than ${MAX_CODES_PER_UPLOAD} codes at once.`);
  }

  const cleanCodes = codes.map(c => String(c).trim()).filter(Boolean);
  if (cleanCodes.length === 0) {
    throw new Error('No valid codes provided after cleaning.');
  }

  // Perform bulk insert
  await db.sql`
    INSERT INTO promo_codes (code, dist_slug)
    SELECT unnest(${cleanCodes}::text[]), ${campaignSlug}
    ON CONFLICT (code) DO NOTHING;
  `;

  return { success: true, count: cleanCodes.length };
}

/**
 * Business Logic: Clear all codes for a campaign
 */
export async function clearCampaignLogic(email, dist) {
  if (!email || !isDeveloper(email)) {
    throw new Error('Forbidden: Developer privileges required.');
  }

  if (!dist) {
    throw new Error('Missing campaign parameter: dist is required.');
  }

  await db.sql`
    DELETE FROM promo_codes 
    WHERE dist_slug = ${dist};
  `;

  return { success: true };
}
