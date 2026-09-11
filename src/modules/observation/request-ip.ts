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

function isValidIpv4(value: string): boolean {
  const octets = value.split('.');
  return octets.length === 4 && octets.every((octet) => {
    if (!/^(0|[1-9]\d{0,2})$/.test(octet)) return false;
    return Number(octet) <= 255;
  });
}

function isValidIpv6(value: string): boolean {
  if (!value.includes(':') || value.includes('%')) return false;

  let candidate = value;
  if (candidate.includes('.')) {
    const separator = candidate.lastIndexOf(':');
    if (separator < 0) return false;
    const ipv4 = candidate.slice(separator + 1);
    if (!isValidIpv4(ipv4)) return false;
    const octets = ipv4.split('.').map(Number);
    const embedded = `${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
    candidate = `${candidate.slice(0, separator)}:${embedded}`;
  }

  if (!/^[0-9a-f:]+$/i.test(candidate)) return false;
  const compression = candidate.indexOf('::');
  if (compression !== -1 && compression !== candidate.lastIndexOf('::')) return false;

  if (compression === -1) {
    const groups = candidate.split(':');
    return groups.length === 8 && groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group));
  }

  const [left, right] = candidate.split('::');
  const leftGroups = left ? left.split(':') : [];
  const rightGroups = right ? right.split(':') : [];
  const groups = [...leftGroups, ...rightGroups];
  return (
    groups.length < 8 &&
    groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))
  );
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
  return isValidIpv4(candidate) || isValidIpv6(candidate) ? candidate : null;
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
