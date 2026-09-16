import { isIP } from 'node:net';

export interface ParsedIp {
  family: 4 | 6;
  bits: 32 | 128;
  value: bigint;
}

function parseIpv4(ip: string): bigint {
  return ip.split('.').reduce((value, part) => (value << BigInt(8)) | BigInt(Number(part)), BigInt(0));
}

function parseIpv6(ip: string): bigint {
  let source = ip.toLowerCase();
  const ipv4Match = source.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Match) {
    const value = parseIpv4(ipv4Match[1]);
    const replacement = `${(value >> BigInt(16)).toString(16)}:${(value & BigInt(0xffff)).toString(16)}`;
    source = source.slice(0, source.length - ipv4Match[1].length) + replacement;
  }

  const halves = source.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const omitted = halves.length === 2 ? 8 - left.length - right.length : 0;
  const groups = [...left, ...Array.from({ length: omitted }, () => '0'), ...right];
  return groups.reduce((value, group) => (value << BigInt(16)) | BigInt(`0x${group || '0'}`), BigInt(0));
}

export function parseIp(ip: string): ParsedIp | undefined {
  const family = isIP(ip);
  if (family === 4) return { family, bits: 32, value: parseIpv4(ip) };
  if (family === 6 && !ip.includes('%')) return { family, bits: 128, value: parseIpv6(ip) };
  return undefined;
}

export function cidrContains(ip: ParsedIp, cidr: string): number | undefined {
  const slash = cidr.lastIndexOf('/');
  if (slash <= 0) return undefined;
  const network = parseIp(cidr.slice(0, slash));
  const prefix = Number(cidr.slice(slash + 1));
  if (!network || network.family !== ip.family || !Number.isInteger(prefix) || prefix < 0 || prefix > ip.bits) return undefined;
  const shift = BigInt(ip.bits - prefix);
  return (ip.value >> shift) === (network.value >> shift) ? prefix : undefined;
}
