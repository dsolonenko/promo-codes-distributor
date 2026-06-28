import { NextResponse } from 'next/server';
import { decryptSession } from '@/lib/auth';
import { sql } from '@vercel/postgres';

export async function GET(request) {
  const sessionCookie = request.cookies.get('auth_session')?.value;
  const user = decryptSession(sessionCookie);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const devEmails = (process.env.DEVELOPER_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase());
  const isDeveloper = devEmails.includes(user.email.toLowerCase());

  if (!isDeveloper) {
    return NextResponse.json({ error: 'Access Denied: Admin privileges required.' }, { status: 403 });
  }

  try {
    const statsRes = await sql`
      SELECT 
        COUNT(*)::INT as total,
        COUNT(claimed_by_email)::INT as claimed,
        (COUNT(*) - COUNT(claimed_by_email))::INT as remaining
      FROM promo_codes;
    `;

    const stats = statsRes.rows[0] || { total: 0, claimed: 0, remaining: 0 };
    return NextResponse.json({ stats });
  } catch (err) {
    console.error('Fetch Stats API Error:', err);
    return NextResponse.json({ error: 'Failed to fetch statistics: ' + err.message }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
