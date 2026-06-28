/**
 * Parses CSV/text content and extracts valid promo codes.
 * Normalizes and filters out common CSV column header titles and metadata.
 *
 * @param {string} text - Raw CSV or text content
 * @returns {string[]} Array of unique valid promo codes
 */
export function extractCodesFromText(text) {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split(/\r?\n/);
  const codes = new Set();
  
  // Blacklist of common header and status values (normalized to uppercase, no spaces/underscores)
  const headerBlacklist = new Set([
    'CODE',
    'PROMO',
    'PROMOCODE',
    'PROMOTION',
    'PROMOTIONCODE',
    'STATUS',
    'STATE',
    'ACTIVE',
    'CLAIMED',
    'UNCLAIMED',
    'EXPIRED',
    'DATE',
    'TIME',
    'TIMESTAMP',
    'CREATED',
    'UPDATED',
    'EMAIL',
    'USER',
    'IDENTIFIER',
    'ID'
  ]);

  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Split by comma, tab, or semicolon
    const cells = line.split(/[,\t;]/).map(c => c.replace(/^["']|["']$/g, '').trim());
    
    for (const cell of cells) {
      // Validate typical alphanumeric promo code structure:
      // 1. Length between 8 and 30 characters
      // 2. Alphanumeric + spaces, hyphens, and underscores
      // 3. MUST contain at least one letter (filters out pure date/timestamp columns)
      if (
        cell.length >= 8 && 
        cell.length <= 30 && 
        /^[A-Z0-9_\-\s]+$/i.test(cell) &&
        /[A-Z]/i.test(cell)
      ) {
        const normalized = cell.replace(/[\s_-]/g, '').toUpperCase();
        
        if (!headerBlacklist.has(normalized)) {
          // Add clean code (strip any interior whitespace)
          codes.add(cell.replace(/\s/g, ''));
        }
      }
    }
  }
  
  return Array.from(codes);
}
