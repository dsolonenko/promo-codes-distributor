-- ============================================================================
-- Closed-Test Code Distributor Vercel Postgres Migration Script
-- Run this script in your Vercel Postgres dashboard SQL console.
-- ============================================================================

CREATE TABLE IF NOT EXISTS promo_codes (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    dist_slug TEXT NOT NULL DEFAULT 'default',
    claimed_by_email TEXT DEFAULT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Drop deprecated index if it exists from previous installations
DROP INDEX IF EXISTS idx_promo_codes_email;

-- Composite index: optimizes lookups for user claims inside a specific campaign distribution
CREATE INDEX IF NOT EXISTS idx_promo_codes_dist_email ON promo_codes(dist_slug, claimed_by_email);
