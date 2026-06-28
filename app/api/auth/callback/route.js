import { NextResponse } from 'next/server';
import { encryptSession } from '@/lib/auth';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;
  const redirectUri = `${origin}/api/auth/callback`;

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_auth_code', origin));
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      throw new Error(`Google token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenRes.json();
    
    // Parse Google's ID Token (JWT)
    const parts = tokenData.id_token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT signature returned by Google.');
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

    if (!payload.email) {
      throw new Error('Google identity did not return an email address.');
    }

    const sessionData = {
      email: payload.email,
      name: payload.name || '',
      picture: payload.picture || '',
      authTime: Date.now()
    };

    const cookieValue = encryptSession(sessionData);

    const response = NextResponse.redirect(new URL('/', origin));
    response.cookies.set('auth_session', cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return response;
  } catch (err) {
    console.error('OAuth Callback Error:', err);
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(err.message)}`, origin));
  }
}
export const dynamic = 'force-dynamic';
