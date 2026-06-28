import { NextResponse } from 'next/server';
import { encryptSession } from '@/lib/auth';

function getOrigin(request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  const origin = getOrigin(request);
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
      console.error('Google token exchange failed:', await tokenRes.text());
      throw new Error('Google authentication failed');
    }

    const tokenData = await tokenRes.json();

    // Verify the ID token with Google's servers (validates signature, expiry, and audience)
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${tokenData.id_token}`
    );
    if (!tokenInfoRes.ok) {
      throw new Error('Google ID token verification failed');
    }
    const payload = await tokenInfoRes.json();

    // Ensure the token was issued for our app, not a different OAuth client
    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw new Error('Token audience mismatch');
    }

    // Reject identities whose email Google has not verified
    if (payload.email_verified !== 'true' && payload.email_verified !== true) {
      throw new Error('Email address is not verified by Google');
    }

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
    return NextResponse.redirect(new URL('/?error=auth_failed', origin));
  }
}
export const dynamic = 'force-dynamic';
