import { NextResponse } from 'next/server';
import { queryRdap, RdapError, type QueryRdapOptions } from './index';

export async function rdapResponse(ip: unknown, options?: QueryRdapOptions) {
  try {
    return NextResponse.json(await queryRdap(ip as string, options));
  } catch (error) {
    const failure = error instanceof RdapError
      ? error
      : new RdapError('RDAP service unavailable', 'UPSTREAM_ERROR', 502);
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
