import { NextResponse } from 'next/server';
import { decryptSession } from '@/lib/auth';
import { claimCodeLogic } from '@/lib/logic';

export async function POST(request) {
  const sessionCookie = request.cookies.get('auth_session')?.value;
  const user = decryptSession(sessionCookie);

  if (!user || !user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { dist } = await request.json();
    const result = await claimCodeLogic(user.email, dist);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Claim Code API Error:', err);
    return NextResponse.json({ error: 'Database transaction failed: ' + err.message }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
