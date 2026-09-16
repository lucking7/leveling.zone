import type { SourceResult } from './types';

// Raw supplier shapes stay inside this module.
type Raw = Record<string, any>;
export function text(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const result = String(value).trim();
  return result && result !== '-' && !/NOT[ _]SUPPORTED|INVALID[ _]IP|MISSING[ _]FILE|IPV6_NOT_SUPPORTED/i.test(result) ? result : undefined;
}
export function asn(value: unknown): string | undefined {
  const result = text(value)?.replace(/^AS/i, '');
  return result && /^\d+$/.test(result) ? 'AS' + result : undefined;
}
function coordinate(value: unknown, limit: number): number | undefined {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : undefined;
}
export function source(label: string, location: Raw = {}, network: Raw = {}, security?: Raw): SourceResult {
  const loc: SourceResult['location'] = {};
  for (const key of ['country', 'countryCode', 'region', 'city', 'district', 'divisionCode', 'continent', 'timezone', 'postalCode', 'description'] as const) {
    const value = text(location[key]);
    if (value) loc[key] = value;
  }
  const latitude = coordinate(location.latitude, 90), longitude = coordinate(location.longitude, 180);
  if (latitude !== undefined && longitude !== undefined) Object.assign(loc, { latitude, longitude });
  const net: SourceResult['network'] = {};
  for (const key of ['organization', 'isp', 'domain', 'route', 'handle', 'description'] as const) {
    const value = text(network[key]);
    if (value) net[key] = value;
  }
  if (asn(network.asn)) net.asn = asn(network.asn);
  const flags = Object.fromEntries(Object.entries(security || {}).filter(([, v]) =>
    typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && Boolean(text(v)))));
  return { label, location: loc, network: net, ...(Object.keys(flags).length ? { security: flags } : {}) };
}
export function hasData(value: SourceResult): boolean {
  return Boolean(Object.keys(value.location).length || Object.keys(value.network).length || Object.keys(value.security || {}).length);
}
function mmdb(label: string, city: Raw = {}, country: Raw = {}, net: Raw = {}): SourceResult {
  return source(label, {
    country: city.country?.names?.en ?? country.country?.names?.en,
    countryCode: city.country?.iso_code ?? country.country?.iso_code,
    region: city.subdivisions?.[0]?.names?.en, city: city.city?.names?.en,
    continent: city.continent?.names?.en ?? country.continent?.names?.en,
    latitude: city.location?.latitude, longitude: city.location?.longitude,
    timezone: city.location?.time_zone, postalCode: city.postal?.code,
  }, { asn: net.autonomous_system_number, organization: net.autonomous_system_organization }, {
    isEU: city.country?.is_in_european_union ?? country.country?.is_in_european_union,
  });
}
export function normalizeLocal(records: Record<string, any>): Record<string, SourceResult> {
  const r = records, sources: Record<string, SourceResult> = {};
  const add = (key: string, value: SourceResult) => { if (hasData(value)) sources[key] = value; };
  add('maxmind', mmdb('MaxMind', r['geolite2-city'] || {}, r['geolite2-country'] || {}, r['geolite2-asn'] || {}));
  add('dbip', mmdb('DB-IP', r['dbip-city'] || {}, r['dbip-country'] || {}, r['dbip-asn'] || {}));
  const geo = r.geocn;
  if (geo && [geo.province, geo.city, geo.districts, geo.isp, geo.division_code].some(v => text(v))) add('geocn', source('GeoCN', { country: '中国', countryCode: 'CN', region: geo.province, city: geo.city, district: geo.districts, divisionCode: geo.division_code }, { isp: geo.isp }));
  const q = r.qqwry?.data ?? r.qqwry;
  if (q && (r.qqwry.code === undefined || r.qqwry.code === 0)) add('qqwry', source('QQWry', {
    country: q.country_name, region: q.region_name, city: q.city_name, district: q.district_name,
  }, { isp: q.isp_domain, organization: q.owner_domain }));
  const ipinfo = r.ipinfo;
  if (ipinfo) add('ipinfo', source('IPinfo', { country: ipinfo.country_name, countryCode: ipinfo.country, continent: ipinfo.continent_name }, {
    asn: ipinfo.asn, organization: ipinfo.as_name, domain: ipinfo.as_domain,
  }));
  const iptoasn = r.iptoasn;
  if (iptoasn) add('iptoasn', source('IPtoASN', {}, { asn: iptoasn.autonomous_system_number, organization: iptoasn.autonomous_system_organization }));
  const loc = r['ip2location-db11'] || {}, net = r['ip2location-asn'] || {}, proxy = r['ip2location-px11'];
  add('ip2location', source('IP2Location', {
    country: loc.countryLong, countryCode: loc.countryShort, region: loc.region, city: loc.city,
    latitude: loc.latitude, longitude: loc.longitude, postalCode: loc.zipCode, timezone: loc.timeZone,
  }, { asn: net.asn, organization: net.as }, proxy && proxy.isProxy >= 0 ? {
    isProxy: proxy.isProxy > 0, proxyType: proxy.proxyType, threat: proxy.threat, usageType: proxy.usageType,
  } : undefined));
  const number = Object.values(sources).map(s => s.network.asn).find(Boolean)?.slice(2);
  const info = Array.isArray(r['as-info']) && r['as-info'].find((row: Raw) => String(row.asn) === number);
  if (info) add('asnInfo', source('ASN Info', {}, { asn: info.asn, handle: info.handle, description: info.description, organization: info.description }));
  return sources;
}
