-- ============================================================================
-- Closed-Test Code Distributor Vercel Postgres Migration Script
-- Run this script in your Vercel Postgres dashboard SQL console.
-- ============================================================================

CREATE TABLE IF NOT EXISTS promo_codes (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    claimed_by_email TEXT DEFAULT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_email ON promo_codes(claimed_by_email);
