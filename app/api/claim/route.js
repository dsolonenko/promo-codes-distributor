import { NextResponse } from 'next/server';
import { decryptSession } from '@/lib/auth';
import { sql } from '@vercel/postgres';

export async function POST(request) {
  const sessionCookie = request.cookies.get('auth_session')?.value;
  const user = decryptSession(sessionCookie);

  if (!user || !user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Idempotency Check: Return existing code if user already has one
    const checkRes = await sql`
      SELECT code FROM promo_codes 
      WHERE claimed_by_email = ${user.email} 
      LIMIT 1
    `;
    
    if (checkRes.rowCount > 0) {
      return NextResponse.json({ code: checkRes.rows[0].code });
    }

    // 2. Concurrency Safety: Atomic pull & lock via FOR UPDATE SKIP LOCKED
    const claimRes = await sql`
      UPDATE promo_codes
      SET 
          claimed_by_email = ${user.email}, 
          claimed_at = NOW()
      WHERE id = (
          SELECT id 
          FROM promo_codes 
          WHERE claimed_by_email IS NULL 
          ORDER BY id ASC
          FOR UPDATE SKIP LOCKED 
          LIMIT 1
      )
      RETURNING code;
    `;

    if (claimRes.rowCount > 0) {
      return NextResponse.json({ code: claimRes.rows[0].code });
    }

    // No codes remaining
    return NextResponse.json({ code: null });

  } catch (err) {
    console.error('Claim Code API Error:', err);
    return NextResponse.json({ error: 'Database transaction failed: ' + err.message }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
