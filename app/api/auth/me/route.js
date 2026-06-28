import { NextResponse } from 'next/server';
import { decryptSession } from '@/lib/auth';

export async function GET(request) {
  const isConfigured = 
    process.env.GOOGLE_CLIENT_ID && 
    process.env.GOOGLE_CLIENT_SECRET && 
    process.env.POSTGRES_URL &&
    !process.env.GOOGLE_CLIENT_ID.includes('your-google-client-id') &&
    !process.env.POSTGRES_URL.includes('postgres://username');

  const sessionCookie = request.cookies.get('auth_session')?.value;
  const user = decryptSession(sessionCookie);

  if (user) {
    const devEmails = (process.env.DEVELOPER_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase());
    
    // In Demo Mode, admin@example.com is always authorized as a developer
    const isDeveloper = devEmails.includes(user.email.toLowerCase()) || 
      (!isConfigured && user.email.toLowerCase() === 'admin@example.com');

    return NextResponse.json({
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture,
        isDeveloper,
        demoMode: !isConfigured
      }
    });
  }

  if (!isConfigured) {
    return NextResponse.json({ configMissing: true });
  }

  return NextResponse.json({ user: null });
}
export const dynamic = 'force-dynamic';
