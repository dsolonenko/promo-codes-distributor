import { NextResponse } from 'next/server';
import { decryptSession } from '@/lib/auth';
import { sql } from '@vercel/postgres';

// helper to check developer auth
function checkDevAuth(request) {
  const sessionCookie = request.cookies.get('auth_session')?.value;
  const user = decryptSession(sessionCookie);

  if (!user) return { error: 'Unauthorized', status: 401 };

  const devEmails = (process.env.DEVELOPER_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase());
  const isDeveloper = devEmails.includes(user.email.toLowerCase());

  if (!isDeveloper) {
    return { error: 'Access Denied: Admin privileges required.', status: 403 };
  }

  return { user };
}

// GET: Get all claimed codes details
export async function GET(request) {
  const auth = checkDevAuth(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const listRes = await sql`
      SELECT code, claimed_by_email, claimed_at 
      FROM promo_codes 
      WHERE claimed_by_email IS NOT NULL 
      ORDER BY claimed_at DESC;
    `;
    return NextResponse.json({ claims: listRes.rows });
  } catch (err) {
    console.error('Fetch Claimed Codes Error:', err);
    return NextResponse.json({ error: 'Failed to fetch claimed codes: ' + err.message }, { status: 500 });
  }
}

// POST: Bulk upload codes
export async function POST(request) {
  const auth = checkDevAuth(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { codes } = await request.json();
    if (!Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ error: 'Invalid payload: Expecting a non-empty array of codes.' }, { status: 400 });
    }

    // Clean codes list
    const cleanCodes = codes.map(c => String(c).trim()).filter(Boolean);
    if (cleanCodes.length === 0) {
      return NextResponse.json({ error: 'No valid codes provided after cleaning.' }, { status: 400 });
    }

    // Perform bulk insert
    await sql`
      INSERT INTO promo_codes (code)
      SELECT unnest(${cleanCodes}::text[])
      ON CONFLICT (code) DO NOTHING;
    `;

    return NextResponse.json({ success: true, count: cleanCodes.length });
  } catch (err) {
    console.error('Bulk Upload Error:', err);
    return NextResponse.json({ error: 'Failed to upload codes: ' + err.message }, { status: 500 });
  }
}

// DELETE: Reset all codes and claims
export async function DELETE(request) {
  const auth = checkDevAuth(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await sql`DELETE FROM promo_codes;`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Purge Codes Error:', err);
    return NextResponse.json({ error: 'Failed to reset database: ' + err.message }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
