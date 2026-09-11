import { SOURCE_CATALOG, type ObservationSourceKey } from './catalog';
import { invalidObservationResponse, requireOk } from './engine';
import type {
  ObservationAdapter,
  ObservationRequestContext,
  ObservationScope,
  ObservationSourceData,
} from './types';

type JsonRecord = Record<string, any>;
type SourceData = Omit<ObservationSourceData, 'observation'>;

async function json(
  context: ObservationRequestContext,
  url: string,
  init?: RequestInit,
): Promise<JsonRecord> {
  const response = await requireOk(await context.request(url, init));
  return response.json() as Promise<JsonRecord>;
}

async function text(
  context: ObservationRequestContext,
  url: string,
  init?: RequestInit,
): Promise<string> {
  const response = await requireOk(await context.request(url, init));
  return response.text();
}

function source(
  key: ObservationSourceKey,
  scope: ObservationScope,
  observe: ObservationAdapter['observe'],
  enabled?: () => boolean,
): ObservationAdapter {
  return { key, name: SOURCE_CATALOG[key].name, scope, observe, enabled };
}

function splitTrace(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of value.split('\n')) {
    const separator = line.indexOf('=');
    if (separator > 0) result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return result;
}

const cloudflare = source('cloudflare', 'server-egress', async (context) => {
  const [traceText, meta] = await Promise.all([
    text(context, 'https://1.1.1.1/cdn-cgi/trace'),
    json(context, 'https://speed.cloudflare.com/meta'),
  ]);
  const trace = splitTrace(traceText);
  if (!trace.ip && !meta.clientIp) invalidObservationResponse();
  return {
    ip: meta.clientIp || trace.ip,
    location: {
      country: meta.country || trace.loc,
      region: meta.region,
      city: meta.city,
      timezone: meta.timezone,
    },
    network: { asn: meta.asn, organization: meta.asOrganization },
  };
});

const useragentinfo = source('useragentinfo', 'server-egress', async (context) => {
  const data = await json(context, 'https://ip.useragentinfo.com/json');
  if (!data.ip) invalidObservationResponse();
  return {
    ip: data.ip,
    location: {
      country: data.country,
      country_code: data.short_name,
      province: data.province,
      city: data.city,
      area: data.area,
    },
    network: { isp: data.isp, type: data.net },
  };
});

const qjqq = source('qjqq', 'server-egress', async (context) => {
  const data = await json(context, 'https://api.qjqq.cn/api/Local');
  if (data.code !== 200 || !data.data) return null;
  return {
    ip: data.data.ip,
    location: {
      country: data.data.country,
      province: data.data.prov,
      city: data.data.city,
      district: data.data.district,
      latitude: data.data.lat,
      longitude: data.data.lng,
      timezone: data.data.time_zone,
    },
    network: { isp: data.data.isp },
  };
});

const identme = source('identme', 'server-egress', async (context) => {
  const data = await json(context, 'https://v4.ident.me/json');
  if (!data.ip) invalidObservationResponse();
  return {
    ip: data.ip,
    location: {
      country: data.country,
      region: data.city,
      city: data.city,
      timezone: data.tz,
      latitude: data.latitude,
      longitude: data.longitude,
    },
    network: { asn: data.asn, organization: data.aso },
  };
});

const ipsb = source('ipsb', 'server-egress', async (context) => {
  const data = await json(context, 'https://api.ip.sb/geoip');
  if (!data.ip) invalidObservationResponse();
  return {
    ip: data.ip,
    location: {
      country: data.country,
      country_code: data.country_code,
      region: data.region,
      city: data.city,
      timezone: data.timezone,
      latitude: data.latitude,
      longitude: data.longitude,
    },
    network: { asn: data.asn, organization: data.asn_organization, isp: data.isp },
  };
});

const ipapi = source('ipapi', 'server-egress', async (context) => {
  const data = await json(context, 'https://api.ipapi.is');
  if (!data.ip || !data.location) invalidObservationResponse();
  return {
    ip: data.ip,
    location: {
      country: data.location.country,
      country_code: data.location.country_code,
      state: data.location.state,
      city: data.location.city,
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      timezone: data.location.timezone,
    },
    network: { asn: data.asn?.asn, organization: data.asn?.org, type: data.asn?.type },
    security: {
      is_proxy: data.is_proxy,
      is_datacenter: data.is_datacenter,
      is_vpn: data.is_vpn,
      is_tor: data.is_tor,
    },
  };
});

const ipapico = source('ipapico', 'server-egress', async (context) => {
  const data = await json(context, 'https://ipapi.co/json/');
  if (!data.ip) invalidObservationResponse();
  return {
    ip: data.ip,
    location: {
      country: data.country_name,
      country_code: data.country_code,
      region: data.region,
      city: data.city,
      timezone: data.timezone,
      latitude: data.latitude,
      longitude: data.longitude,
    },
    network: { asn: data.asn, organization: data.org },
  };
});

const ipapiio = source('ipapiio', 'server-egress', async (context) => {
  const data = await json(context, 'https://ip-api.io/json');
  if (!data.ip) invalidObservationResponse();
  return {
    ip: data.ip,
    location: {
      country: data.country_name,
      country_code: data.country_code,
      region: data.region_name,
      city: data.city,
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.time_zone,
    },
    network: { organization: data.organisation },
    security: {
      isProxy: data.suspiciousFactors?.isProxy,
      isSpam: data.suspiciousFactors?.isSpam,
      isTorNode: data.suspiciousFactors?.isTorNode,
    },
  };
});

const zhale = source('zhale', 'server-egress', async (context) => {
  const data = await json(context, 'https://ipv4cn.zhale.me/ip.php');
  if (!data.ip) invalidObservationResponse();
  const location = typeof data.location === 'string' ? data.location.split(', ') : [];
  return { ip: data.ip, location: { country: location[0], province: location[1] } };
});

const pconline = source('pconline', 'server-egress', async (context) => {
  const response = await requireOk(
    await context.request('https://whois.pconline.com.cn/ipJson.jsp?json=true', {
      headers: { 'Accept-Charset': 'GB2312,utf-8;q=0.7,*;q=0.3' },
    }),
  );
  const decoded = new TextDecoder('gb2312').decode(await response.arrayBuffer());
  const data = JSON.parse(decoded) as JsonRecord;
  if (!data.ip) invalidObservationResponse();
  return {
    ip: data.ip,
    location: { country: '中国', province: data.pro, city: data.city },
    network: { isp: data.addr },
  };
});

const meitu = source('meitu', 'server-egress', async (context) => {
  const data = await json(context, 'https://webapi-pc.meitu.com/common/ip_location');
  if (data.code !== 0 || !data.data) return null;
  const first = data.data[Object.keys(data.data)[0]];
  if (!first) invalidObservationResponse();
  return {
    location: {
      country: first.nation,
      country_code: first.nation_code,
      province: first.province,
      city: first.city,
      latitude: first.latitude,
      longitude: first.longitude,
      timezone: first.time_zone,
    },
    network: { isp: first.isp },
  };
});

const ipcn = source('ipcn', 'server-egress', async (context) => {
  const data = await json(context, 'https://www.ip.cn/api/index?type=0');
  if (data.rs !== 1 || !data.ip) return null;
  const address = typeof data.address === 'string' ? data.address.split(' ') : [];
  const isp = address.pop();
  return {
    ip: data.ip,
    location: { country: address.filter(Boolean).join(' • ') },
    network: { isp },
  };
});

const iplark = source('iplark', 'server-egress', async (context) => {
  const data = await json(context, 'https://iplark.com/ipstack');
  if (!data.country_name && !data.ip) invalidObservationResponse();
  return {
    ip: data.ip,
    location: {
      country: data.country_name,
      country_code: data.country_code,
      region: data.region_name,
      city: data.city,
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.time_zone?.id,
    },
    network: { type: data.ip_routing_type, connection: data.connection_type },
  };
});

const qifu = source('qifu', 'server-egress', async (context) => {
  const data = await json(context, 'https://qifu-api.baidubce.com/ip/local/geo/v1/district');
  if (data.code !== 'Success' || !data.data) return null;
  return {
    ip: data.ip,
    location: {
      country: data.data.country,
      province: data.data.prov,
      city: data.data.city,
      district: data.data.district,
    },
    network: { isp: data.data.owner || data.data.isp },
  };
});

const qqnews = source('qqnews', 'server-egress', async (context) => {
  const data = await json(context, 'https://r.inews.qq.com/api/ip2city');
  if (data.ret !== 0 || !data.ip) return null;
  return {
    ip: data.ip,
    location: {
      country: data.country,
      province: data.province,
      city: data.city,
      district: data.district,
    },
    network: { isp: data.isp },
  };
});

const ipip = source('ipip', 'server-egress', async (context) => {
  const data = await json(context, 'https://myip.ipip.net/json');
  if (data.ret !== 'ok' || !data.data) return null;
  return {
    ip: data.data.ip,
    location: {
      country: data.data.location?.[0],
      province: data.data.location?.[1],
      city: data.data.location?.[2],
      district: data.data.location?.[3],
    },
    network: { isp: data.data.location?.[4] },
  };
});

const vore = source('vore', 'server-egress', async (context) => {
  const data = await json(context, 'https://api.vore.top/api/IPdata');
  if (data.code !== 200 || !data.ipinfo || !data.ipdata) return null;
  return {
    ip: data.ipinfo.text,
    location: {
      country: data.ipdata.info1,
      province: data.ipdata.info2,
      city: data.ipdata.info3,
    },
    network: { isp: data.ipdata.isp, type: data.ipinfo.type },
  };
});

const toutiao = source('toutiao', 'server-egress', async (context) => {
  const data = await json(context, 'https://www.toutiao.com/stream/widget/local_weather/data/');
  if (!data.success || !data.data) return null;
  return {
    location: {
      country: data.data.country,
      province: data.data.province,
      city: data.data.city,
      district: data.data.district,
    },
    network: { isp: data.data.isp },
  };
});

const upyun = source('upyun', 'server-egress', async (context) => {
  const data = await json(context, 'https://pubstatic.b0.upaiyun.com/?_upnode');
  if (!data.remote_addr) invalidObservationResponse();
  return {
    ip: data.remote_addr,
    location: {
      country: data.remote_addr_location?.country,
      province: data.remote_addr_location?.province,
      city: data.remote_addr_location?.city,
    },
    network: { isp: data.remote_addr_location?.isp },
  };
});

const amap = source(
  'amap',
  'request-ip',
  async (context) => {
    const key = process.env.AMAP_API_KEY;
    if (!key) return null;
    const data = await json(
      context,
      `https://restapi.amap.com/v3/ip?key=${encodeURIComponent(key)}&ip=${encodeURIComponent(context.requestedIp)}`,
    );
    if (data.status !== '1') return null;
    return {
      ip: context.requestedIp,
      location: { province: data.province, city: data.city },
    };
  },
  () => Boolean(process.env.AMAP_API_KEY),
);

const apipcc = source('apipcc', 'server-egress', async (context) => {
  const data = await json(context, 'https://apip.cc/json');
  if (data.status !== 'success' || !data.query) return null;
  return {
    ip: data.query,
    location: {
      country: data.CountryName,
      region: data.RegionName,
      city: data.City,
      timezone: data.TimeZone,
      latitude: data.Latitude,
      longitude: data.Longitude,
    },
    network: { asn: data.asn, organization: data.org },
  };
});

const zxinc = source('zxinc', 'server-egress', async (context) => {
  const data = await json(context, 'https://v4.ip.zxinc.org/info.php?type=json');
  if (data.code !== 0 || !data.data?.myip) return null;
  return {
    ip: data.data.myip,
    location: { country: data.data.country },
    network: { isp: data.data.local },
    meta: { version: data.data.ver4, count4: data.data.count4, count6: data.data.count6 },
  };
});

const ipquery = source('ipquery', 'server-egress', async (context) => {
  const data = await json(context, 'https://api.ipquery.io/?format=json');
  if (!data.ip) invalidObservationResponse();
  return {
    ip: data.ip,
    location: {
      country: data.location?.country,
      region: data.location?.state,
      city: data.location?.city,
      timezone: data.location?.timezone,
      latitude: data.location?.latitude,
      longitude: data.location?.longitude,
    },
    network: { asn: data.isp?.asn, organization: data.isp?.org, isp: data.isp?.isp },
    security: {
      is_vpn: data.risk?.is_vpn,
      is_proxy: data.risk?.is_proxy,
      is_datacenter: data.risk?.is_datacenter,
      risk_score: data.risk?.risk_score,
    },
  };
});

const ip138 = source('ip138', 'server-egress', async (context) => {
  const data = await json(context, 'https://ip138.xyz/json');
  if (!data.ip) invalidObservationResponse();
  return {
    ip: data.ip,
    location: {
      country: data.country,
      country_code: data.country_iso,
      region: data.region_name,
      city: data.city,
      timezone: data.time_zone,
      latitude: data.latitude,
      longitude: data.longitude,
    },
    network: { asn: data.asn, organization: data.asn_org },
    meta: { zip_code: data.zip_code, metro_code: data.metro_code },
  };
});

const ping0 = source('ping0', 'server-egress', async (context) => {
  const data = await text(context, 'https://ping0.cc/geo');
  const parts = data.split(' AS');
  if (parts.length < 2) invalidObservationResponse();
  const [ip, ...location] = parts[0].trim().split(' ');
  const [asn, ...organization] = parts[1].trim().split(' ');
  return {
    ip,
    location: { country: location.join(' ') },
    network: { asn, organization: organization.join(' ') },
  };
});

const meituan = source('meituan', 'request-ip', async (context) => {
  const location = await json(
    context,
    `https://apimobile.meituan.com/locate/v2/ip/loc?client_source=webapi&rgeo=true&ip=${encodeURIComponent(context.requestedIp)}`,
  );
  if (!location.data?.lat || !location.data?.lng) return null;
  const details = await json(
    context,
    `https://apimobile.meituan.com/group/v1/city/latlng/${encodeURIComponent(location.data.lat)},${encodeURIComponent(location.data.lng)}?tag=0`,
  );
  return {
    ip: context.requestedIp,
    location: {
      latitude: location.data.lat,
      longitude: location.data.lng,
      country: location.data.rgeo?.country,
      province: location.data.rgeo?.province,
      city: location.data.rgeo?.city,
      district: location.data.rgeo?.district,
      area_name: details.data?.areaName,
      detail: details.data?.detail,
    },
    accuracy: {
      confidence: details.data?.confidence,
      level: details.data?.level,
      is_foreign: details.data?.isForeign,
    },
    meta: {
      city_id: details.data?.dpCityId,
      area_id: details.data?.area,
      city_pinyin: details.data?.cityPinyin,
    },
  };
});

export const OBSERVATION_ADAPTERS: readonly ObservationAdapter[] = [
  cloudflare,
  useragentinfo,
  qjqq,
  identme,
  ipsb,
  ipapi,
  ipapico,
  ipapiio,
  zhale,
  pconline,
  meitu,
  ipcn,
  iplark,
  qifu,
  qqnews,
  ipip,
  vore,
  toutiao,
  upyun,
  amap,
  apipcc,
  zxinc,
  ipquery,
  ip138,
  ping0,
  meituan,
];
