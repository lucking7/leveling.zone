import { NextRequest, NextResponse } from 'next/server';
import { queryVisitor } from '@/modules/query/visitor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const result = await queryVisitor(request.headers);
    return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Visitor lookup failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
