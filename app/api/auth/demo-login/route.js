import { NextResponse } from 'next/server';
import { encryptSession } from '@/lib/auth';

export async function POST(request) {
  try {
    const { email } = await request.json();
    const cleanEmail = email ? String(email).trim().toLowerCase() : 'tester@example.com';
    const username = cleanEmail.split('@')[0];
    const friendlyName = username.charAt(0).toUpperCase() + username.slice(1);

    const sessionData = {
      email: cleanEmail,
      name: friendlyName,
      picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
      authTime: Date.now()
    };

    const cookieValue = encryptSession(sessionData);

    const response = NextResponse.json({ success: true });
    response.cookies.set('auth_session', cookieValue, {
      httpOnly: true,
      secure: false, // Development safe
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: 'Demo authentication failed: ' + err.message }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
