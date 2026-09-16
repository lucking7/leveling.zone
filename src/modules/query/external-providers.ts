import { source, text } from './normalize';
import type { SourceResult } from './types';

type Raw = Record<string, any>;

export interface ParsedExternal {
  raw: Raw;
  normalized: SourceResult;
  echoIp?: unknown;
}

export interface ExternalAttempt {
  url: string;
  body: 'json' | 'text' | 'gbk';
  parse(value: unknown): ParsedExternal;
}

export interface ExternalProvider {
  label: string;
  transport: 'direct' | 'html.zone relay';
  attempts(ip: string): ExternalAttempt[];
}

function record(value: unknown): Raw {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('schema');
  return value as Raw;
}

function nested(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {};
}

function coords(value: unknown): [unknown, unknown] {
  if (typeof value !== 'string') return [undefined, undefined];
  const [latitude, longitude] = value.split(',');
  return [latitude, longitude];
}

function result(raw: Raw, normalized: SourceResult, echoIp?: unknown): ParsedExternal {
  return { raw, normalized, echoIp };
}

function json(url: string, parse: (raw: Raw) => ParsedExternal): ExternalAttempt {
  return { url, body: 'json', parse(value) { return parse(record(value)); } };
}

function ip2location(raw: Raw, label: string): ParsedExternal {
  return result(raw, source(label, {
    country: raw.country_name, countryCode: raw.country_code, region: raw.region_name, city: raw.city_name,
    district: raw.district, latitude: raw.latitude, longitude: raw.longitude, timezone: raw.time_zone,
    postalCode: raw.zip_code,
  }, {
    asn: raw.asn, organization: raw.as, isp: raw.isp, domain: raw.domain,
  }, {
    isProxy: raw.is_proxy, proxyType: raw.proxy?.proxy_type, threat: raw.proxy?.threat,
    fraudScore: raw.fraud_score,
  }), raw.ip);
}

function parseHtmlEntities(value: string): string {
  return value.replace(/&(quot|amp|lt|gt|#39);/g, entity => ({
    '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&#39;': "'",
  })[entity] || entity).replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function parseIp2locationBody(value: unknown, label: string): ParsedExternal {
  if (typeof value !== 'string') throw new Error('schema');
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    const match = value.match(/<code\b[^>]*class=["'][^"']*\blanguage-json\b[^"']*["'][^>]*>([\s\S]*?)<\/code>/i);
    if (!match) throw new Error('schema');
    parsed = JSON.parse(parseHtmlEntities(match[1]));
  }
  return ip2location(record(parsed), label);
}

function parseJsonp(value: unknown): Raw {
  if (typeof value !== 'string') throw new Error('schema');
  try { return record(JSON.parse(value)); } catch {}
  const match = value.match(/(?:IPCallBack|callback)\s*\(\s*(\{[\s\S]*\})\s*\)/i);
  if (!match) throw new Error('schema');
  return record(JSON.parse(match[1]));
}

function provider(label: string, transport: ExternalProvider['transport'], attempts: ExternalProvider['attempts']): ExternalProvider {
  return { label, transport, attempts };
}

export const externalProviders = {
  ipbase: provider('ipbase.com', 'direct', ip => [json(`https://api.ipbase.com/v2/info?ip=${ip}`, raw => {
    const data = nested(raw.data), location = nested(data.location), connection = nested(data.connection);
    return result(raw, source('ipbase.com', {
      country: location.country?.name, countryCode: location.country?.alpha2, region: location.region?.name,
      city: location.city?.name, latitude: location.latitude, longitude: location.longitude,
    }, { asn: connection.asn, organization: connection.organization, isp: connection.isp }), data.ip);
  })]),

  ipdata: provider('ipdata.co', 'html.zone relay', ip => [json(`https://cloudflare.html.zone/api/ip/ipdata?ip=${ip}`, raw =>
    result(raw, source('ipdata.co', {
      country: raw.country_name, countryCode: raw.country_code, region: raw.region, city: raw.city,
      latitude: raw.latitude, longitude: raw.longitude, timezone: raw.time_zone?.name,
    }, { asn: raw.asn?.asn, organization: raw.asn?.name, domain: raw.asn?.domain }), raw.ip))]),

  ipquery: provider('ipquery.io', 'direct', ip => [json(`https://api.ipquery.io/${ip}?format=json`, raw => {
    const location = nested(raw.location), isp = nested(raw.isp);
    return result(raw, source('ipquery.io', {
      country: location.country, countryCode: location.country_code, region: location.state, city: location.city,
      latitude: location.latitude, longitude: location.longitude, timezone: location.timezone,
    }, { asn: isp.asn, organization: isp.org, isp: isp.isp }), raw.ip);
  })]),

  ipregistry: provider('ipregistry.co', 'html.zone relay', ip => [json(`https://cloudflare.html.zone/api/ip/ipregistry?ip=${ip}`, raw => {
    const location = nested(raw.location), connection = nested(raw.connection), company = nested(raw.company);
    return result(raw, source('ipregistry.co', {
      country: location.country?.name, countryCode: location.country?.code, region: location.region?.name,
      city: location.city, latitude: location.latitude, longitude: location.longitude, timezone: location.time_zone?.id,
      postalCode: location.postal,
    }, {
      asn: connection.asn, organization: connection.organization || company.name, domain: connection.domain || company.domain,
      isp: connection.isp,
    }), raw.ip);
  })]),

  ip2location_io: provider('ip2location.io', 'html.zone relay', ip => [
    { url: `https://cloudflare.html.zone/api/ip/ip2location?ip=${ip}`, body: 'text', parse: value => parseIp2locationBody(value, 'ip2location.io') },
    { url: `https://ip2location.io/${ip}`, body: 'text', parse: value => parseIp2locationBody(value, 'ip2location.io') },
  ]),

  dbip_demo: provider('DB-IP online', 'direct', ip => [json(`https://db-ip.com/demo/home.php?s=${ip}`, raw => {
    const data = raw.status === 'ok' ? nested(raw.demoInfo) : {};
    return result(raw, source('DB-IP online', {
      country: data.countryName, countryCode: data.countryCode, region: data.stateProv, city: data.city,
      latitude: data.latitude, longitude: data.longitude,
    }, { asn: data.asNumber, organization: data.organization, isp: data.isp }), data.ipAddress || data.ip);
  })]),

  ipinfo_demo: provider('IPinfo online', 'direct', ip => [
    json(`https://ipinfo.io/${ip}/json`, raw => {
      const [latitude, longitude] = coords(raw.loc);
      const [asn, ...organization] = typeof raw.org === 'string' ? raw.org.split(' ') : [];
      return result(raw, source('IPinfo online', {
        country: raw.country, countryCode: raw.country, region: raw.region, city: raw.city, latitude, longitude,
        timezone: raw.timezone, postalCode: raw.postal,
      }, { asn, organization: organization.join(' ') }), raw.ip);
    }),
    json(`https://ipinfo.io/widget/demo/${ip}`, raw => {
      const data = nested(raw.data), [latitude, longitude] = coords(data.loc);
      const [asn, ...organization] = typeof data.org === 'string' ? data.org.split(' ') : [];
      return result(raw, source('IPinfo online (demo fallback)', {
        country: data.country, countryCode: data.country, region: data.region, city: data.city, latitude, longitude,
        timezone: data.timezone, postalCode: data.postal,
      }, {
        asn: data.asn?.asn || asn, organization: data.asn?.name || organization.join(' '), domain: data.asn?.domain,
      }), data.ip);
    }),
  ]),

  baidu_open: provider('Baidu Open Platform', 'html.zone relay', ip => [json(`https://cloudflare.html.zone/api/ip/baidu?ip=${ip}`, raw => {
    const row = Array.isArray(raw.data) ? nested(raw.data[0]) : {};
    const [country, ...network] = typeof row.location === 'string' ? row.location.trim().split(/\s+/) : [];
    return result(raw, source('Baidu Open Platform', { country }, { isp: network.join(' ') }), row.origip);
  })]),

  baidu_qifu: provider('Baidu Qifu', 'direct', ip => [json(`https://qifu.baidu.com/ip/geo/v1/district?ip=${ip}`, raw => {
    if (raw.code !== undefined && raw.code !== 'Success') throw new Error('upstream');
    const data = nested(raw.data);
    return result(raw, source('Baidu Qifu', {
      country: data.country, countryCode: data.areacode, region: data.prov, city: data.city, district: data.district,
    }, { isp: data.isp }), raw.ip);
  })]),

  baidu_qifu_backup: provider('Baidu Qifu backup', 'direct', ip => [json(`https://qifu-api.baidubce.com/ip/geo/v1/district?ip=${ip}`, raw => {
    if (raw.code !== undefined && raw.code !== 'Success') throw new Error('upstream');
    const data = nested(raw.data);
    return result(raw, source('Baidu Qifu backup', {
      country: data.country, countryCode: data.areacode, region: data.prov, city: data.city, district: data.district,
    }, { isp: data.isp }), raw.ip);
  })]),

  taobao: provider('Taobao', 'html.zone relay', ip => [json(`https://cloudflare.html.zone/api/ip/taobao?ip=${ip}`, raw => {
    if (raw.code !== undefined && raw.code !== 0) throw new Error('upstream');
    const data = nested(raw.data);
    return result(raw, source('Taobao', {
      country: data.country, countryCode: data.country_id, region: data.region, city: data.city, district: data.area,
    }, { isp: data.isp }), data.ip);
  })]),

  cz88: provider('CZ88 official API', 'direct', ip => [json(`https://update.cz88.net/api/cz88/ip/base?ip=${ip}`, raw => {
    if (raw.code !== undefined && raw.code !== 200) throw new Error('upstream');
    const data = nested(raw.data), country = nested(data.country);
    return result(raw, source('CZ88 official API', {
      country: typeof data.country === 'string' ? data.country : country.name || country.countryName,
      countryCode: country.countryCode, region: data.province, city: data.city, district: data.districts,
    }, { isp: data.isp, description: data.netWorkType }), data.ip);
  })]),

  ipip: provider('IPIP database', 'html.zone relay', ip => [json(`https://vercel.html.zone/api/ip/ipip?ip=${ip}`, raw => {
    if (raw.code !== undefined && raw.code !== 0) throw new Error('upstream');
    const data = nested(raw.data);
    return result(raw, source('IPIP database', {
      country: data.country_name, region: data.region_name, city: data.city_name,
    }, { isp: data.isp_domain, organization: data.owner_domain }), data.ip);
  })]),

  amap: provider('AMap', 'direct', ip => {
    const key = process.env.AMAP_API_KEY;
    if (!key) return [];
    return [json(`https://restapi.amap.com/v3/ip?key=${encodeURIComponent(key)}&ip=${ip}`, raw => {
      if (raw.status !== '1') throw new Error('upstream');
      if (!text(raw.province) && !text(raw.city)) throw new Error('schema');
      return result(raw, source('AMap', { country: '中国', countryCode: 'CN', region: raw.province, city: raw.city }));
    })];
  }),

  zxinc: provider('ZXINC', 'direct', ip => [json(`https://ip.zxinc.org/api.php?type=json&ip=${ip}`, raw => {
    if (raw.code !== undefined && raw.code !== 0) throw new Error('upstream');
    const data = nested(raw.data), ipData = nested(data.ip);
    return result(raw, source('ZXINC', { description: data.location }), ipData.query);
  })]),

  pconline: provider('PCOnline', 'direct', ip => [{
    url: `https://whois.pconline.com.cn/ipJson.jsp?ip=${ip}`, body: 'gbk', parse(value) {
      const raw = parseJsonp(value);
      return result(raw, source('PCOnline', { description: raw.addr }), raw.ip);
    },
  }]),

  zhale: provider('ZHALE.ME', 'direct', ip => [json(`https://zhale.me/v1/ipinfo/${ip}`, raw => {
    const data = nested(raw.Data);
    return result(raw, source('ZHALE.ME', { country: data.Country, region: data.Region, city: data.City }, { isp: data.ISP }), data.IP);
  })]),

  ipsb: provider('IP.SB', 'direct', ip => [json(`https://api.ip.sb/geoip/${ip}`, raw =>
    result(raw, source('IP.SB', {
      country: raw.country, countryCode: raw.country_code, region: raw.region, city: raw.city,
      latitude: raw.latitude, longitude: raw.longitude, timezone: raw.timezone, postalCode: raw.postal_code,
    }, { asn: raw.asn, organization: raw.organization, isp: raw.isp }), raw.ip))]),

  ipapi_co: provider('ipapi.co', 'direct', ip => [json(`https://ipapi.co/${ip}/json/`, raw =>
    result(raw, source('ipapi.co', {
      country: raw.country_name, countryCode: raw.country_code || raw.country, region: raw.region, city: raw.city,
      latitude: raw.latitude, longitude: raw.longitude, timezone: raw.timezone, postalCode: raw.postal,
    }, { asn: raw.asn, organization: raw.org }), raw.ip))]),

  ip_api: provider('ip-api.com', 'html.zone relay', ip => [json(`https://cloudflare.html.zone/api/ip/ip-api?ip=${ip}`, raw => {
    if (raw.status === 'fail') throw new Error('upstream');
    const combinedAs = typeof raw.as === 'string' ? raw.as.trim() : '';
    const combinedMatch = combinedAs.match(/(?:^|\s)(AS\d+)(?:\s|$)/i);
    return result(raw, source('ip-api.com', {
      country: raw.country, countryCode: raw.countryCode, region: raw.regionName, city: raw.city,
      latitude: raw.lat, longitude: raw.lon, timezone: raw.timezone, postalCode: raw.zip,
    }, {
      asn: combinedMatch?.[1],
      organization: raw.org || (combinedMatch ? combinedAs.slice(combinedMatch.index! + combinedMatch[0].length).trim() : undefined),
      isp: raw.isp, domain: raw.reverse,
    }, {
      isProxy: raw.proxy, isHosting: raw.hosting, isMobile: raw.mobile,
    }), raw.query);
  })]),

  ipwhois: provider('ipwho.is', 'direct', ip => [json(`https://ipwho.is/${ip}`, raw => {
    if (raw.success === false) throw new Error('upstream');
    return result(raw, source('ipwho.is', {
      country: raw.country, countryCode: raw.country_code, region: raw.region, city: raw.city,
      latitude: raw.latitude, longitude: raw.longitude, timezone: raw.timezone?.id, postalCode: raw.postal,
    }, { asn: raw.connection?.asn, organization: raw.connection?.org, isp: raw.connection?.isp, domain: raw.connection?.domain }, {
      isProxy: raw.security?.proxy, isVpn: raw.security?.vpn, isTor: raw.security?.tor,
    }), raw.ip);
  })]),

  ipgeolocation: provider('ipgeolocation.io', 'html.zone relay', ip => [json(`https://cloudflare.html.zone/api/ip/ipgeolocation?ip=${ip}`, raw =>
    result(raw, source('ipgeolocation.io', {
      country: raw.country_name, countryCode: raw.country_code2, region: raw.state_prov, city: raw.city,
      latitude: raw.latitude, longitude: raw.longitude, timezone: raw.time_zone?.name, postalCode: raw.zipcode,
    }, { asn: raw.asn, organization: raw.organization, isp: raw.isp, domain: raw.domain, description: raw.connection_type }), raw.ip))]),

  freeipapi: provider('freeipapi.com', 'direct', ip => [json(`https://freeipapi.com/api/json/${ip}`, raw =>
    result(raw, source('freeipapi.com', {
      country: raw.countryName, countryCode: raw.countryCode, region: raw.regionName, city: raw.cityName,
      latitude: raw.latitude, longitude: raw.longitude, timezone: raw.timeZone, postalCode: raw.zipCode,
    }), raw.ipAddress))]),

  ipapi_is: provider('ipapi.is', 'direct', ip => [json(`https://api.ipapi.is/?q=${ip}`, raw =>
    result(raw, source('ipapi.is', {
      country: raw.location?.country, countryCode: raw.location?.country_code, region: raw.location?.state,
      city: raw.location?.city, latitude: raw.location?.latitude, longitude: raw.location?.longitude,
      timezone: raw.location?.timezone, postalCode: raw.location?.zip,
    }, { asn: raw.asn?.asn, organization: raw.asn?.org, route: raw.asn?.route }, {
      isProxy: raw.is_proxy, isVpn: raw.is_vpn, isTor: raw.is_tor, isDatacenter: raw.is_datacenter,
    }), raw.ip))]),

  apip_cc: provider('apip.cc', 'direct', ip => [json(`https://apip.cc/api-json/${ip}`, raw =>
    result(raw, source('apip.cc', {
      country: raw.CountryName, countryCode: raw.CountryCode, region: raw.RegionName, city: raw.City,
      latitude: raw.Latitude, longitude: raw.Longitude, timezone: raw.TimeZone, postalCode: raw.ZipCode,
    }, { asn: raw.asn, organization: raw.org, isp: raw.isp }), raw.query))]),
} as const satisfies Record<string, ExternalProvider>;

export type ExternalProviderId = keyof typeof externalProviders;
