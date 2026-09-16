import { isIP } from 'node:net';
import { hasData } from './normalize';
import { externalProviders, type ExternalProviderId, type ParsedExternal } from './external-providers';
import { permitsExternal } from './policy';
import type { SourceResult } from './types';

export const externalIds = [
  'ipbase', 'ipdata', 'ipquery', 'ipregistry', 'ip2location_io', 'dbip_demo', 'ipinfo_demo',
  'baidu_open', 'baidu_qifu', 'baidu_qifu_backup', 'taobao', 'cz88', 'ipip', 'amap', 'zxinc',
  'pconline', 'zhale', 'ipsb', 'ipapi_co', 'ip_api', 'ipwhois', 'ipgeolocation', 'freeipapi',
  'ipapi_is', 'apip_cc',
] as const satisfies readonly ExternalProviderId[];
export type ExternalId = typeof externalIds[number];

export class ExternalError extends Error {}

function canonicalIp(ip: string): string {
  if (isIP(ip) === 4) return ip.split('.').map(part => String(Number(part))).join('.');
  const hostname = new URL(`http://[${ip}]/`).hostname;
  return hostname.slice(1, -1).toLowerCase();
}

function assertResponse(parsed: ParsedExternal, requestedIp: string): void {
  const raw = parsed.raw;
  if (raw.error || raw.error_info || raw.success === false || raw.status === 'fail' || raw.status === 'error') {
    throw new ExternalError('Invalid source response');
  }
  if (parsed.echoIp !== undefined && parsed.echoIp !== null && parsed.echoIp !== '') {
    if (typeof parsed.echoIp !== 'string' || !isIP(parsed.echoIp) || canonicalIp(parsed.echoIp) !== canonicalIp(requestedIp)) {
      throw new ExternalError('Source returned a different IP');
    }
  }
  // Echoing the requested IP is validation metadata, not a successful data record.
  if (!hasData(parsed.normalized)) throw new ExternalError('Source returned no record');
}

function ip2locationRaw(raw: Record<string, any>, normalized: SourceResult): Record<string, any> {
  return {
    location: {
      ...normalized.location,
      coordinates: raw.latitude != null && raw.longitude != null ? `${raw.latitude}, ${raw.longitude}` : undefined,
      zipCode: raw.zip_code,
    },
    network: { ...normalized.network, type: raw.usage_type },
    security: {
      isProxy: raw.is_proxy, proxyType: raw.proxy?.proxy_type,
      threat: raw.proxy?.threat, fraudScore: raw.fraud_score,
    },
    meta: {
      continent: raw.continent, country: raw.country, region: raw.region,
      city: raw.city, timeZone: raw.time_zone_info,
    },
  };
}

export async function fetchExternal(
  id: ExternalId,
  ip: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 4000,
): Promise<{ raw: any; normalized: SourceResult }> {
  if (!isIP(ip)) throw new ExternalError('Invalid IP address');
  if (!permitsExternal(ip)) throw new ExternalError('Non-public IP is local only');
  const provider = externalProviders[id];
  if (!provider) throw new ExternalError('Unknown source');

  const attempts = provider.attempts(encodeURIComponent(ip));
  if (!attempts.length) throw new ExternalError('Source credentials unavailable');

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ExternalError('Source timed out'));
    }, Math.max(0, timeoutMs));
  });

  try {
    const lookup = async () => {
      let lastError: ExternalError = new ExternalError('Source request failed');
      for (const attempt of attempts) {
        if (controller.signal.aborted) throw new ExternalError('Source timed out');
        try {
          const response = await fetcher(attempt.url, { signal: controller.signal, cache: 'no-store' });
          if (!response.ok) throw new ExternalError(`Source HTTP ${response.status}`);
          const value = attempt.body === 'gbk'
            ? new TextDecoder('gbk').decode(await response.arrayBuffer())
            : attempt.body === 'text' ? await response.text() : await response.json();
          if (controller.signal.aborted) throw new ExternalError('Source timed out');
          const parsed = attempt.parse(value);
          assertResponse(parsed, ip);
          return {
            raw: id === 'ip2location_io' ? ip2locationRaw(parsed.raw, parsed.normalized) : parsed.raw,
            normalized: parsed.normalized,
          };
        } catch (error) {
          if (controller.signal.aborted) throw new ExternalError('Source timed out');
          lastError = error instanceof ExternalError ? error : new ExternalError('Invalid source response');
        }
      }
      throw lastError;
    };
    return await Promise.race([deadline, lookup()]);
  } catch (error) {
    throw error instanceof ExternalError ? error : new ExternalError('Source request failed');
  } finally {
    clearTimeout(timer);
  }
}
