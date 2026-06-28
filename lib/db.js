import { sql as vercelSql } from '@vercel/postgres';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'db.json');
let isMigrationEnsured = false;

// Reads local JSON file database
function readLocalDb() {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to read local db.json, returning empty array:', err);
    return [];
  }
}

// Writes local JSON file database
function writeLocalDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write to local db.json:', err);
  }
}

/**
 * database connector object.
 * Checks for process.env.POSTGRES_URL configuration; falls back to a 
 * local, zero-config JSON-file database emulator if postgres is unconfigured.
 */
export const db = {
  sql: async (strings, ...values) => {
    const isConfigured = 
      process.env.POSTGRES_URL && 
      !process.env.POSTGRES_URL.includes('postgres://username');

    if (!isConfigured) {
      // ----------------------------------------------------------------------
      // Zero-Config Local JSON File Database Emulator
      // ----------------------------------------------------------------------
      let mockDb = readLocalDb();
      const query = strings.join('?').trim().replace(/\s+/g, ' ');
      let result = { rowCount: 0, rows: [] };

      // 1. Idempotency Check: SELECT code FROM promo_codes WHERE dist_slug = ? AND claimed_by_email = ? LIMIT 1
      if (query.includes('SELECT code FROM promo_codes WHERE dist_slug') && query.includes('claimed_by_email = ? LIMIT 1')) {
        const [dist, email] = values;
        const rows = mockDb.filter(r => r.dist_slug === dist && r.claimed_by_email === email);
        result = { rowCount: rows.length, rows };
      }
      
      // 2. Concurrency Safety UPDATE: UPDATE promo_codes SET claimed_by_email = ? WHERE id = (...) RETURNING code
      else if (query.includes('UPDATE promo_codes SET') && query.includes('claimed_by_email = ?') && query.includes('RETURNING code')) {
        const [email, dist] = values;
        const index = mockDb.findIndex(r => r.dist_slug === dist && r.claimed_by_email === null);
        if (index !== -1) {
          mockDb[index].claimed_by_email = email;
          mockDb[index].claimed_at = new Date().toISOString();
          result = { rowCount: 1, rows: [mockDb[index]] };
        }
      }
      
      // 3. Admin: GET stats aggregated by dist_slug
      else if (query.includes('SELECT dist_slug') && query.includes('COUNT(*)') && query.includes('GROUP BY dist_slug')) {
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
        result = { rows: Object.values(groups) };
      }
      
      // 4. Admin: GET logs filtered by dist_slug
      else if (query.includes('SELECT code, claimed_by_email, claimed_at FROM promo_codes WHERE dist_slug')) {
        const [dist] = values;
        const rows = mockDb.filter(r => r.dist_slug === dist && r.claimed_by_email !== null);
        result = { rows };
      }
      
      // 5. Admin: POST bulk upload codes
      else if (query.includes('INSERT INTO promo_codes') && query.includes('ON CONFLICT (code) DO NOTHING')) {
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
        result = { rowCount: inserted };
      }
      
      // 6. Admin: DELETE Reset campaign distribution
      else if (query.includes('DELETE FROM promo_codes WHERE dist_slug')) {
        const [dist] = values;
        mockDb = mockDb.filter(r => r.dist_slug !== dist);
        result = { rowCount: 1 };
      }

      writeLocalDb(mockDb);
      return result;
    }

    // ----------------------------------------------------------------------
    // Standard production Vercel Postgres client
    // ----------------------------------------------------------------------
    if (!isMigrationEnsured) {
      try {
        await vercelSql`
          CREATE TABLE IF NOT EXISTS promo_codes (
            id SERIAL PRIMARY KEY,
            code VARCHAR(255) UNIQUE NOT NULL,
            dist_slug VARCHAR(255) NOT NULL,
            claimed_by_email VARCHAR(255) DEFAULT NULL,
            claimed_at TIMESTAMP DEFAULT NULL
          );
        `;
        await vercelSql`
          CREATE INDEX IF NOT EXISTS idx_promo_codes_dist_email 
          ON promo_codes (dist_slug, claimed_by_email);
        `;
        isMigrationEnsured = true;
        console.log('Database tables successfully verified/created.');
      } catch (err) {
        console.error('Failed to run automatic startup migrations:', err);
      }
    }

    return vercelSql(strings, ...values);
  }
};
