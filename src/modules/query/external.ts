import { isIP } from 'node:net';
import { permitsExternal } from './policy';
import { source, hasData } from './normalize';
import type { SourceResult } from './types';

export const externalIds = ['ipbase', 'ipdata', 'ipquery', 'ipregistry', 'ip2location_io', 'dbip_demo', 'ipinfo_demo'] as const;
export type ExternalId = typeof externalIds[number];
export class ExternalError extends Error {}
export async function fetchExternal(id: ExternalId, ip: string, fetcher: typeof fetch = fetch, timeoutMs = 4000): Promise<{ raw: any; normalized: SourceResult }> {
  if (!isIP(ip)) throw new ExternalError('Invalid IP address');
  if (!permitsExternal(ip)) throw new ExternalError('Non-public IP is local only');
  const value = encodeURIComponent(ip);
  const urls: Record<ExternalId, string> = {
    ipbase: 'https://api.ipbase.com/v2/info?ip=' + value,
    ipdata: 'https://cloudflare.html.zone/api/ip/ipdata?ip=' + value,
    ipquery: 'https://api.ipquery.io/' + value + '?format=json',
    ipregistry: 'https://cloudflare.html.zone/api/ip/ipregistry?ip=' + value,
    ip2location_io: 'https://ip2location.io/' + value,
    dbip_demo: 'https://db-ip.com/demo/home.php?s=' + value,
    ipinfo_demo: 'https://ipinfo.io/widget/demo/' + value,
  };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new ExternalError('Source timed out')); }, timeoutMs);
  });
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetcher(urls[id], { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new ExternalError('Source HTTP ' + response.status);
      let raw: any;
      if (id === 'ip2location_io') {
        const html = await response.text();
        const match = html.match(/class="language-json">([\s\S]*?)<\/code>/);
        if (!match) throw new ExternalError('Source returned no record');
        raw = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
      } else raw = await response.json();
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.error) throw new ExternalError('Invalid source response');
      let normalized: SourceResult;
      if (id === 'ipdata') normalized = source('ipdata.co', {
        country: raw.country_name, countryCode: raw.country_code, region: raw.region, city: raw.city,
        latitude: raw.latitude, longitude: raw.longitude,
      }, { asn: raw.asn?.asn, organization: raw.asn?.name, domain: raw.asn?.domain });
      else if (id === 'ipbase') {
        const d = raw.data || {}, l = d.location || {}, n = d.connection || {};
        normalized = source('ipbase.com', { country: l.country?.name, countryCode: l.country?.alpha2, region: l.region?.name, city: l.city?.name, latitude: l.latitude, longitude: l.longitude }, { asn: n.asn, organization: n.organization, isp: n.isp });
      } else if (id === 'ipregistry') {
        const l = raw.location || {}, n = raw.connection || {};
        normalized = source('ipregistry.io', { country: l.country?.name, countryCode: l.country?.code, region: l.region?.name, city: l.city, latitude: l.latitude, longitude: l.longitude }, { asn: n.asn, organization: n.organization, domain: n.domain, isp: n.isp });
      } else if (id === 'ipquery') {
        const l = raw.location || {}, n = raw.isp || {};
        normalized = source('ipquery.io', { country: l.country, countryCode: l.country_code, region: l.state, city: l.city, latitude: l.latitude, longitude: l.longitude, timezone: l.timezone }, { asn: n.asn, organization: n.org, isp: n.isp });
      } else if (id === 'dbip_demo') {
        const d = raw.status === 'ok' ? raw.demoInfo || {} : {};
        normalized = source('DB-IP online', { country: d.countryName, countryCode: d.countryCode, region: d.stateProv, city: d.city, latitude: d.latitude, longitude: d.longitude }, { asn: d.asNumber, organization: d.organization, isp: d.isp });
      } else if (id === 'ipinfo_demo') {
        const d = raw.data || {}, coords = (d.loc || '').split(',');
        normalized = source('IPinfo online', { country: d.country, region: d.region, city: d.city, latitude: coords[0], longitude: coords[1], timezone: d.timezone }, { asn: d.asn?.asn || d.org?.split(' ')[0], organization: d.asn?.name || d.org?.split(' ').slice(1).join(' '), domain: d.asn?.domain });
      } else normalized = source('ip2location.io', {
        country: raw.country_name, countryCode: raw.country_code, region: raw.region_name, city: raw.city_name,
        district: raw.district, latitude: raw.latitude, longitude: raw.longitude, timezone: raw.time_zone, postalCode: raw.zip_code,
      }, { asn: raw.asn, organization: raw.as, isp: raw.isp, domain: raw.domain }, { isProxy: raw.is_proxy });
      if (!hasData(normalized)) throw new ExternalError('Source returned no record');
      // The existing supplier route exposes a normalized shape for this one source.
      return { raw: id === 'ip2location_io' ? {
        location: {
          ...normalized.location,
          coordinates: raw.latitude != null && raw.longitude != null ? String(raw.latitude) + ', ' + String(raw.longitude) : undefined,
          zipCode: raw.zip_code,
        },
        network: { ...normalized.network, type: raw.usage_type },
        security: {
          isProxy: raw.is_proxy, proxyType: raw.proxy?.proxy_type,
          threat: raw.proxy?.threat, fraudScore: raw.fraud_score,
        },
        meta: { continent: raw.continent, country: raw.country, region: raw.region,
          city: raw.city, timeZone: raw.time_zone_info },
      } : raw, normalized };
    })()]);
  } catch (error) {
    throw error instanceof ExternalError ? error : new ExternalError('Source request failed');
  } finally { clearTimeout(timer); }
}
