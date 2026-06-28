import { NextResponse } from 'next/server';
import { decryptSession } from '@/lib/auth';
import { getClaimedCodesLogic, uploadCodesLogic, clearCampaignLogic } from '@/lib/logic';

function getAuthUser(request) {
  const sessionCookie = request.cookies.get('auth_session')?.value;
  return decryptSession(sessionCookie);
}

// GET: Get all claimed codes details for a specific campaign distribution
export async function GET(request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dist = searchParams.get('dist') || 'default';

  try {
    const result = await getClaimedCodesLogic(user.email, dist);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Fetch Claimed Codes Error:', err);
    const status = err.message.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// POST: Bulk upload codes for a specific campaign distribution
export async function POST(request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { dist, codes } = await request.json();
    const result = await uploadCodesLogic(user.email, dist, codes);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Bulk Upload Error:', err);
    const status = err.message.includes('Forbidden') ? 403 : err.message.includes('Invalid') ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// DELETE: Reset all codes and claims for a specific campaign distribution
export async function DELETE(request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { dist } = await request.json();
    const result = await clearCampaignLogic(user.email, dist);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Purge Codes Error:', err);
    const status = err.message.includes('Forbidden') ? 403 : err.message.includes('Missing') ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
export const dynamic = 'force-dynamic';
