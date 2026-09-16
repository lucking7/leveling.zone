import { NextRequest } from 'next/server';
import { rdapResponse } from '@/modules/rdap/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: { ip: string } }) {
  return rdapResponse(params.ip);
}
