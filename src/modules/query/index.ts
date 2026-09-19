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
  const errors = Object.fromEntries(Object.keys(local.errors).map(id => [id, local.errors[id] === 'Database not installed' ? 'Database not installed' : 'Database unavailable or query failed']));
  if (options.external !== false && permitsExternal(ip)) {
    const results: PromiseSettledResult<Awaited<ReturnType<typeof fetchExternal>>>[] = new Array(externalIds.length);
    let cursor = 0;
    // Bound upstream fan-out as the catalog grows; retain catalog order in the response.
    await Promise.all(Array.from({ length: Math.min(8, externalIds.length) }, async () => {
      while (cursor < externalIds.length) {
        const index = cursor++;
        try {
          results[index] = { status: 'fulfilled', value: await fetchExternal(externalIds[index], ip, options.fetcher, options.timeoutMs) };
        } catch (reason) { results[index] = { status: 'rejected', reason }; }
      }
    }));
    results.forEach((result, i) => {
      const id = externalIds[i];
      if (result.status === 'fulfilled') sources[id] = result.value;
      else errors[id] = 'Source unavailable';
    });
  }
  return { ip, sources, errors, generation: local.generation, timestamp: new Date().toISOString(),
    status: Object.keys(sources).length ? (Object.keys(errors).length ? 'partial' : 'ok') : 'unavailable' };
}
