import type {
  RdapEntity,
  RdapErrorCode,
  RdapEvent,
  RdapLink,
  RdapResult,
  RdapTextBlock,
} from './types';
import { cidrContains, parseIp, type ParsedIp } from './ip';

export type { RdapEntity, RdapErrorCode, RdapResult } from './types';

const BOOTSTRAP_URLS = {
  4: 'https://data.iana.org/rdap/ipv4.json',
  6: 'https://data.iana.org/rdap/ipv6.json',
} as const;

const REGISTRIES: Record<string, { name: string; basePath: string }> = {
  'rdap.afrinic.net': { name: 'AFRINIC', basePath: '/rdap/' },
  'rdap.apnic.net': { name: 'APNIC', basePath: '/' },
  'rdap.arin.net': { name: 'ARIN', basePath: '/registry/' },
  'rdap.db.ripe.net': { name: 'RIPE NCC', basePath: '/' },
  'rdap.lacnic.net': { name: 'LACNIC', basePath: '/rdap/' },
};

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_TOTAL_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const BOOTSTRAP_TTL_MS = 6 * 60 * 60 * 1_000;
const RESULT_TTL_MS = 5 * 60 * 1_000;
const RESULT_CACHE_LIMIT = 128;

interface BootstrapData {
  services: unknown;
}

interface BootstrapCacheEntry {
  expiresAt: number;
  data: BootstrapData;
}

interface ResultCacheEntry {
  expiresAt: number;
  value: RdapResult;
}

export interface QueryRdapOptions {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  totalTimeoutMs?: number;
  maxResponseBytes?: number;
  now?: () => number;
  cache?: boolean;
}

export class RdapError extends Error {
  constructor(message: string, readonly code: RdapErrorCode, readonly status: 400 | 404 | 429 | 502 | 504) {
    super(message);
    this.name = 'RdapError';
  }
}

const bootstrapCache = new Map<4 | 6, BootstrapCacheEntry>();
const resultCache = new Map<string, ResultCacheEntry>();

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function safeRdapBase(value: unknown): URL | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password) return undefined;
    const registry = REGISTRIES[url.hostname.toLowerCase()];
    if (!registry || url.pathname !== registry.basePath || url.search || url.hash) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function rdapQueryUrl(base: URL, ip: string): URL {
  return new URL(`ip/${ip}`, base);
}

function safeRedirectUrl(location: string | null, current: URL, ip: ParsedIp): URL | undefined {
  if (!location) return undefined;
  try {
    const url = new URL(location, current);
    if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password || url.search || url.hash) return undefined;
    const registry = REGISTRIES[url.hostname.toLowerCase()];
    if (!registry) return undefined;
    const path = decodeURIComponent(url.pathname);
    const prefix = `${registry.basePath}ip/`;
    if (!path.startsWith(prefix)) return undefined;
    const redirectedIp = parseIp(path.slice(prefix.length));
    if (!redirectedIp || redirectedIp.family !== ip.family || redirectedIp.value !== ip.value) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function publicLink(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

async function readBody(response: Response, maxBytes: number): Promise<string> {
  const length = Number(response.headers?.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) throw new RdapError('RDAP service unavailable', 'UPSTREAM_ERROR', 502);

  if (!response.body || typeof response.body.getReader !== 'function') {
    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > maxBytes) throw new RdapError('RDAP service unavailable', 'UPSTREAM_ERROR', 502);
    return body;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new RdapError('RDAP service unavailable', 'UPSTREAM_ERROR', 502);
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

interface RequestOptions {
  fetcher: typeof fetch;
  timeoutMs: number;
  maxResponseBytes: number;
  deadlineAt: number;
}

type FetchResult =
  | { type: 'json'; value: Record<string, unknown> }
  | { type: 'redirect'; location: string | null };

async function fetchOnce(
  url: string,
  purpose: 'bootstrap' | 'record',
  options: RequestOptions,
  allowRedirect: boolean,
): Promise<FetchResult> {
  const remaining = options.deadlineAt - Date.now();
  if (remaining <= 0) throw new RdapError('RDAP request timed out', 'UPSTREAM_TIMEOUT', 504);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new RdapError('RDAP request timed out', 'UPSTREAM_TIMEOUT', 504));
    }, Math.min(options.timeoutMs, remaining));
  });

  try {
    return await Promise.race([timeout, (async () => {
      const response = await options.fetcher(url, {
        signal: controller.signal,
        redirect: 'manual',
        cache: 'no-store',
        headers: { Accept: 'application/rdap+json, application/json' },
      });
      if (response.status >= 300 && response.status < 400) {
        if (allowRedirect) return { type: 'redirect' as const, location: response.headers.get('location') };
        throw new RdapError('RDAP service unavailable', 'UPSTREAM_ERROR', 502);
      }
      if (!response.ok) {
        if (purpose === 'record' && response.status === 404) throw new RdapError('RDAP record not found', 'NOT_FOUND', 404);
        if (response.status === 429) throw new RdapError('RDAP service rate limited', 'RATE_LIMITED', 429);
        throw new RdapError('RDAP service unavailable', 'UPSTREAM_ERROR', 502);
      }
      const body = await readBody(response, options.maxResponseBytes);
      let value: unknown;
      try {
        value = JSON.parse(body);
      } catch {
        throw new RdapError('RDAP service unavailable', 'UPSTREAM_ERROR', 502);
      }
      if (!record(value)) throw new RdapError('RDAP service unavailable', 'UPSTREAM_ERROR', 502);
      return { type: 'json' as const, value };
    })()]);
  } catch (error) {
    if (error instanceof RdapError) throw error;
    throw new RdapError('RDAP service unavailable', 'UPSTREAM_ERROR', 502);
  } finally {
    clearTimeout(timer);
  }
}

async function getBootstrap(ip: ParsedIp, now: number, options: RequestOptions & { cache: boolean }): Promise<BootstrapData> {
  const cached = bootstrapCache.get(ip.family);
  if (options.cache && cached && cached.expiresAt > now) return cached.data;
  const response = await fetchOnce(BOOTSTRAP_URLS[ip.family], 'bootstrap', options, false);
  if (response.type !== 'json') throw new RdapError('RDAP service unavailable', 'UPSTREAM_ERROR', 502);
  const data = response.value as unknown as BootstrapData;
  if (!Array.isArray(data.services)) throw new RdapError('RDAP service unavailable', 'UPSTREAM_ERROR', 502);
  if (options.cache) bootstrapCache.set(ip.family, { data, expiresAt: now + BOOTSTRAP_TTL_MS });
  return data;
}

async function fetchRecord(initial: URL, ip: ParsedIp, options: RequestOptions): Promise<{ endpoint: URL; raw: Record<string, unknown> }> {
  let endpoint = initial;
  const seen = new Set([endpoint.toString()]);
  for (let redirects = 0; ; redirects++) {
    const response = await fetchOnce(endpoint.toString(), 'record', options, true);
    if (response.type === 'json') return { endpoint, raw: response.value };
    if (redirects >= MAX_REDIRECTS) throw new RdapError('RDAP service unavailable', 'UPSTREAM_ERROR', 502);
    const next = safeRedirectUrl(response.location, endpoint, ip);
    if (!next || seen.has(next.toString())) throw new RdapError('RDAP service unavailable', 'UPSTREAM_ERROR', 502);
    seen.add(next.toString());
    endpoint = next;
  }
}

function findEndpoint(ip: ParsedIp, data: BootstrapData): URL | undefined {
  let endpoint: URL | undefined;
  let longestPrefix = -1;
  if (!Array.isArray(data.services)) return undefined;
  for (const service of data.services) {
    if (!Array.isArray(service) || !Array.isArray(service[0]) || !Array.isArray(service[1])) continue;
    const base = service[1].map(safeRdapBase).find((url): url is URL => !!url);
    if (!base) continue;
    for (const cidr of service[0]) {
      if (typeof cidr !== 'string') continue;
      const prefix = cidrContains(ip, cidr);
      if (prefix !== undefined && prefix > longestPrefix) {
        endpoint = base;
        longestPrefix = prefix;
      }
    }
  }
  return endpoint;
}

type VcardProperty = [unknown, unknown, unknown, unknown];

function vcardProperties(entity: Record<string, unknown>): VcardProperty[] {
  const vcard = entity.vcardArray;
  if (!Array.isArray(vcard) || !Array.isArray(vcard[1])) return [];
  return vcard[1].filter((property): property is VcardProperty => Array.isArray(property) && property.length >= 4);
}

function propertyValues(properties: VcardProperty[], key: string): string[] {
  return properties.filter(property => property[0] === key).flatMap(property => {
    const value = property[3];
    if (typeof value === 'string') return [value.replace(/^tel:/, '')];
    if (Array.isArray(value)) return [value.filter(item => typeof item === 'string' && item).join(', ')];
    return [];
  }).filter(Boolean);
}

function entityAddress(properties: VcardProperty[]): string {
  return properties.filter(property => property[0] === 'adr').map(property => {
    const params = record(property[1]) ? property[1] : {};
    const label = text(params.label);
    if (label) return label;
    return Array.isArray(property[3]) ? property[3].filter(item => typeof item === 'string' && item).join(', ') : text(property[3]);
  }).filter(Boolean).join('\n');
}

function entities(value: unknown): RdapEntity[] {
  const found: RdapEntity[] = [];
  const visit = (items: unknown) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!record(item)) continue;
      const properties = vcardProperties(item);
      found.push({
        handle: text(item.handle),
        name: propertyValues(properties, 'fn')[0] || propertyValues(properties, 'org')[0] || '',
        roles: strings(item.roles),
        emails: propertyValues(properties, 'email'),
        phones: propertyValues(properties, 'tel'),
        address: entityAddress(properties),
      });
      visit(item.entities);
    }
  };
  visit(value);
  return found;
}

function events(value: unknown): RdapEvent[] {
  return Array.isArray(value) ? value.filter(record).map(event => ({
    action: text(event.eventAction),
    date: text(event.eventDate),
  })) : [];
}

function textBlocks(value: unknown): RdapTextBlock[] {
  return Array.isArray(value) ? value.filter(record).map(item => ({
    title: text(item.title),
    description: strings(item.description),
  })) : [];
}

function links(value: unknown): RdapLink[] {
  return Array.isArray(value) ? value.filter(record).map(link => ({
    title: text(link.title) || text(link.rel),
    href: publicLink(link.href),
  })).filter(link => link.href) : [];
}

function cidrs(raw: Record<string, unknown>): string[] {
  if (!Array.isArray(raw.cidr0_cidrs)) return [];
  return raw.cidr0_cidrs.filter(record).flatMap(value => {
    const prefix = text(value.v4prefix) || text(value.v6prefix);
    const length = value.length;
    return prefix && Number.isInteger(length) ? [`${prefix}/${length}`] : [];
  });
}

function normalize(ip: string, endpoint: URL, raw: Record<string, unknown>): RdapResult {
  return {
    ip,
    registry: REGISTRIES[endpoint.hostname.toLowerCase()]?.name || '',
    endpoint: endpoint.toString(),
    network: {
      handle: text(raw.handle),
      name: text(raw.name),
      type: text(raw.type),
      startAddress: text(raw.startAddress),
      endAddress: text(raw.endAddress),
      ipVersion: text(raw.ipVersion) || (parseIp(ip)?.family === 4 ? 'v4' : 'v6'),
      country: text(raw.country),
      parentHandle: text(raw.parentHandle),
      cidrs: cidrs(raw),
    },
    entities: entities(raw.entities),
    events: events(raw.events),
    remarks: textBlocks(raw.remarks),
    notices: textBlocks(raw.notices),
    links: links(raw.links),
    raw,
  };
}

function isMatchingNetwork(raw: Record<string, unknown>, ip: ParsedIp): boolean {
  if (raw.objectClassName !== 'ip network' || typeof raw.startAddress !== 'string' || typeof raw.endAddress !== 'string') return false;
  const start = parseIp(raw.startAddress);
  const end = parseIp(raw.endAddress);
  return !!start && !!end && start.family === ip.family && end.family === ip.family
    && start.value <= ip.value && ip.value <= end.value;
}

function putResultCache(ip: string, value: RdapResult, expiresAt: number) {
  resultCache.delete(ip);
  resultCache.set(ip, { value: clone(value), expiresAt });
  while (resultCache.size > RESULT_CACHE_LIMIT) resultCache.delete(resultCache.keys().next().value as string);
}

export async function queryRdap(ip: string, options: QueryRdapOptions = {}): Promise<RdapResult> {
  const parsed = typeof ip === 'string' ? parseIp(ip) : undefined;
  if (!parsed) throw new RdapError('Invalid IP address', 'INVALID_IP', 400);

  const now = (options.now || Date.now)();
  const useCache = options.cache !== false;
  const cached = resultCache.get(ip);
  if (useCache && cached && cached.expiresAt > now) {
    resultCache.delete(ip);
    resultCache.set(ip, cached);
    return clone(cached.value);
  }
  if (cached) resultCache.delete(ip);

  const requestOptions = {
    fetcher: options.fetcher || fetch,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    deadlineAt: Date.now() + (options.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS),
    maxResponseBytes: options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
    cache: useCache,
  };
  const bootstrap = await getBootstrap(parsed, now, requestOptions);
  const base = findEndpoint(parsed, bootstrap);
  if (!base) throw new RdapError('RDAP record not found', 'NOT_FOUND', 404);
  const { endpoint, raw } = await fetchRecord(rdapQueryUrl(base, ip), parsed, requestOptions);
  if (!isMatchingNetwork(raw, parsed)) {
    throw new RdapError('RDAP service unavailable', 'UPSTREAM_ERROR', 502);
  }
  const value = normalize(ip, endpoint, raw);
  if (useCache) putResultCache(ip, value, now + RESULT_TTL_MS);
  return value;
}
