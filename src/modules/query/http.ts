import { NextRequest, NextResponse } from 'next/server';
import { queryIP, InvalidIP } from './index';
import { fetchExternal, type ExternalId } from './external';
import { isIP } from 'node:net';
import { legacy } from './legacy';
export { legacy } from './legacy';

export async function queryResponse(ip: unknown, compat = false, external = true) {
  try {
    const result = await queryIP(ip as string, { external });
    return NextResponse.json(compat ? legacy(result) : result, { status: result.status === 'unavailable' ? 503 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof InvalidIP ? error.message : 'IP query failed' }, { status: error instanceof InvalidIP ? 400 : 500 });
  }
}
export function supplierRoute(id: ExternalId) {
  return async (_request: NextRequest, { params }: { params: { ip: string } }) => {
    if (!isIP(params.ip) || params.ip.includes('%')) return NextResponse.json({ error: 'Invalid IP address' }, { status: 400 });
    try { return NextResponse.json((await fetchExternal(id, params.ip)).raw); }
    catch { return NextResponse.json({ error: 'Source unavailable' }, { status: 502 }); }
  };
}
