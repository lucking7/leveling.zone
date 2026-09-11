import { NextRequest } from 'next/server';
import { queryResponse } from '@/modules/query/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, { params }: { params: { ip: string } }) {
  return queryResponse(params.ip, false, request.nextUrl.searchParams.get('external') !== 'false');
}
