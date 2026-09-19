import { isIP } from 'node:net';

export type RequestIpSource =
  | 'cf-connecting-ip'
  | 'x-real-ip'
  | 'x-forwarded-for'
  | 'runtime'
  | 'unavailable';

export interface ResolvedRequestIp {
  ip: string;
  source: RequestIpSource;
}

function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  let candidate = value.trim().replace(/^"|"$/g, '');
  const bracketed = candidate.match(/^\[([^\]]+)](?::\d+)?$/);
  if (bracketed) candidate = bracketed[1];
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.slice(0, candidate.lastIndexOf(':'));
  }
  if (candidate.length > 45) return null;
  return !candidate.includes('%') && isIP(candidate) ? candidate : null;
}

export function resolveRequestIp(headers: Headers, runtimeIp?: string): ResolvedRequestIp {
  const candidates: Array<[RequestIpSource, string | null | undefined]> = [
    ['cf-connecting-ip', headers.get('cf-connecting-ip')],
    ['x-real-ip', headers.get('x-real-ip')],
    ['x-forwarded-for', headers.get('x-forwarded-for')?.split(',')[0]],
    ['runtime', runtimeIp],
  ];

  for (const [source, value] of candidates) {
    const ip = normalizeIp(value);
    if (ip) return { ip, source };
  }
  return { ip: '未知', source: 'unavailable' };
}
