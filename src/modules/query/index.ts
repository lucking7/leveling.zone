import { isIP } from 'node:net';
import { queryDatabases } from '../database';
import { normalizeLocal } from './normalize';
import { externalIds, fetchExternal } from './external';
import { permitsExternal } from './policy';
import type { QueryResult } from './types';
export type { QueryResult, SourceResult } from './types';

export class InvalidIP extends Error {}
export async function queryIP(ip: string, options: {
  external?: boolean;
  databases?: typeof queryDatabases;
  fetcher?: typeof fetch;
  timeoutMs?: number;
} = {}): Promise<QueryResult> {
  if (typeof ip !== 'string' || !isIP(ip) || ip.includes('%')) throw new InvalidIP('Invalid IP address');
  const local = await (options.databases || queryDatabases)(ip);
  const sources = normalizeLocal(local.records);
  const errors = Object.fromEntries(Object.keys(local.errors).map(id => [id, 'Database unavailable or query failed']));
  if (options.external !== false && permitsExternal(ip)) {
    const results = await Promise.allSettled(externalIds.map(id => fetchExternal(id, ip, options.fetcher, options.timeoutMs)));
    results.forEach((result, i) => {
      const id = externalIds[i];
      if (result.status === 'fulfilled') sources[id] = result.value.normalized;
      else errors[id] = 'Source unavailable';
    });
  }
  return { ip, sources, errors, generation: local.generation, timestamp: new Date().toISOString(),
    status: Object.keys(sources).length ? (Object.keys(errors).length ? 'partial' : 'ok') : 'unavailable' };
}
