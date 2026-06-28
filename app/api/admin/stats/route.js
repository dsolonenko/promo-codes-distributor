import { NextResponse } from 'next/server';
import { decryptSession } from '@/lib/auth';
import { getStatsLogic } from '@/lib/logic';

export async function GET(request) {
  const sessionCookie = request.cookies.get('auth_session')?.value;
  const user = decryptSession(sessionCookie);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await getStatsLogic(user.email);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Fetch Stats API Error:', err);
    if (err.message.includes('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
