import { NextResponse } from 'next/server';
import { queryIP, InvalidIP } from './index';
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
