import { NextResponse } from 'next/server';

function getOrigin(request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export async function GET(request) {
  const origin = getOrigin(request);
  const redirectUri = `${origin}/api/auth/callback`;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || clientId.includes('your-google-client-id')) {
    return NextResponse.json({ 
      error: 'Google OAuth Client ID is not configured on the server.' 
    }, { status: 500 });
  }

  const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email profile',
    access_type: 'online',
    prompt: 'select_account'
  }).toString();

  return NextResponse.redirect(googleAuthUrl);
}
export const dynamic = 'force-dynamic';
