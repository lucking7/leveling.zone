import { NextRequest, NextResponse } from 'next/server';
import { queryResponse } from '@/modules/query/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  return queryResponse(request.nextUrl.searchParams.get('ip'), true, request.nextUrl.searchParams.get('external') !== 'false');
}
export async function POST(request: NextRequest) {
  let body: { ip?: unknown };
  try {
    body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
  } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const ip = body.ip ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ?? request.ip;
  return queryResponse(ip, true, false);
}
