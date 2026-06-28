import { NextResponse } from 'next/server';

export async function GET(request) {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  const response = NextResponse.redirect(new URL('/', origin));
  response.cookies.set('auth_session', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/'
  });
  return response;
}
export const dynamic = 'force-dynamic';
