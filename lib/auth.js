import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'dev-fallback-secret-key-at-least-32-chars-long';

/**
 * Encrypts session object into a signed Base64 token.
 * Uses SHA256 HMAC signature validation to prevent tampering.
 */
export function encryptSession(sessionData) {
  const payload = Buffer.from(JSON.stringify(sessionData)).toString('base64');
  const hmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

/**
 * Decrypts and validates the signature of a session token.
 * Returns the decoded session object or null if validation fails.
 */
export function decryptSession(sessionCookie) {
  if (!sessionCookie) return null;
  
  const parts = sessionCookie.split('.');
  if (parts.length !== 2) return null;
  
  const [payload, hmac] = parts;
  const expectedHmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  
  // Constant time comparison (if crypto.timingSafeEqual is available, otherwise simple string match)
  let isValid = false;
  try {
    isValid = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
  } catch (e) {
    isValid = hmac === expectedHmac;
  }
  
  if (!isValid) {
    console.error('Session security validation failed (HMAC mismatch)');
    return null;
  }
  
  try {
    return JSON.parse(Buffer.from(payload, 'base64').toString());
  } catch (err) {
    console.error('Session payload decryption parsing error', err);
    return null;
  }
}
