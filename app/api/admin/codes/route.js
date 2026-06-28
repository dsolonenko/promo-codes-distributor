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
    if (err.message.includes('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to fetch codes' }, { status: 500 });
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
    if (err.message.includes('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message.includes('Invalid') || err.message.includes('No valid')) return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: 'Failed to upload codes' }, { status: 500 });
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
    if (err.message.includes('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message.includes('Missing')) return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: 'Failed to clear campaign' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
