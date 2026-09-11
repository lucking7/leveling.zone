import { BlockList, isIP } from 'node:net';

const privateV4 = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) privateV4.addSubnet(network, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const specialV6 = new BlockList();
specialV6.addSubnet('2001::', 23, 'ipv6');
specialV6.addSubnet('2001:db8::', 32, 'ipv6');
specialV6.addSubnet('2002::', 16, 'ipv6');
specialV6.addSubnet('3fff::', 20, 'ipv6');
/** Non-public targets stay local, even when external sources are requested. */
export function permitsExternal(ip: string): boolean {
  const family = isIP(ip);
  return family === 4 ? !privateV4.check(ip, 'ipv4') :
    family === 6 && globalV6.check(ip, 'ipv6') && !specialV6.check(ip, 'ipv6');
}
