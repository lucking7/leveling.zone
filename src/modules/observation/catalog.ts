export const SOURCE_CATALOG = {
  qifu: { name: '百度企服', region: 'china' },
  meitu: { name: '美图 IP', region: 'china' },
  pconline: { name: '太平洋 IP', region: 'china' },
  ipcn: { name: 'IP.CN', region: 'china' },
  ipip: { name: 'IPIP.NET', region: 'china' },
  vore: { name: 'VORE-API', region: 'china' },
  toutiao: { name: '今日头条', region: 'china' },
  upyun: { name: '又拍云', region: 'china' },
  qqnews: { name: '腾讯新闻', region: 'china' },
  zhale: { name: 'ZHALE.ME', region: 'china' },
  zxinc: { name: 'ZXINC', region: 'china' },
  amap: { name: '高德地图', region: 'china' },
  meituan: { name: '美团地图', region: 'china' },
  cloudflare: { name: 'Cloudflare', region: 'global' },
  identme: { name: 'ident.me', region: 'global' },
  useragentinfo: { name: 'UserAgent.info', region: 'global' },
  qjqq: { name: 'QJQQ', region: 'global' },
  ipsb: { name: 'IP.SB', region: 'global' },
  ipapi: { name: 'IPAPI.is', region: 'global' },
  ipapico: { name: 'ipapi.co', region: 'global' },
  ipapiio: { name: 'ip-api.io', region: 'global' },
  iplark: { name: 'IPLark', region: 'global' },
  ipquery: { name: 'ipquery.io', region: 'global' },
  apipcc: { name: 'APIP.CC', region: 'global' },
  ip138: { name: 'IP138.xyz', region: 'global' },
  ping0: { name: 'Ping0.cc', region: 'global' },
} as const;

export type ObservationSourceKey = keyof typeof SOURCE_CATALOG;

export function displaySourceName(key: string): string {
  const entry = SOURCE_CATALOG[key as ObservationSourceKey];
  if (!entry) return key;
  return `${entry.region === 'china' ? '🇨🇳' : '🌐'} ${entry.name}`;
}

export function sourceRegion(key: string): 'china' | 'global' | 'unknown' {
  return SOURCE_CATALOG[key as ObservationSourceKey]?.region ?? 'unknown';
}
