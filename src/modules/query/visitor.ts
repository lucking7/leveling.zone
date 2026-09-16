import { queryIP } from './index';
import { resolveRequestIp } from '../observation/request-ip';

// Automatic visitor lookups stay local: no address is sent to IP-echo services.
export async function queryVisitor(headers: Headers, lookup: typeof queryIP = queryIP) {
  const visitor = resolveRequestIp(headers);
  if (visitor.source === 'unavailable') {
    return { status: 400, body: { error: 'Visitor IP could not be identified', ip: visitor.ip, ipSource: visitor.source } };
  }
  const result = await lookup(visitor.ip, { external: false });
  const sources = Object.fromEntries(Object.entries(result.sources).map(([id, data]) => [id, {
    ...data,
    ip: visitor.ip,
    observation: { scope: 'request-ip' as const, source: data.label },
  }]));
  return {
    status: Object.keys(sources).length ? 200 : 503,
    body: {
      ip: visitor.ip,
      ipSource: visitor.source,
      sources,
      generation: result.generation,
      timestamp: result.timestamp,
      observation: {
        semantics: 'request-ip' as const,
        requestIpSourceCount: Object.keys(sources).length,
        serverEgressSourceCount: 0,
        failures: Object.keys(result.errors).map(source => ({ source, reason: result.errors[source] === 'Database not installed' ? 'not-installed' as const : 'lookup-failed' as const })),
      },
      ...(Object.keys(sources).length === 0 && { error: 'No local database returned usable visitor data' }),
    },
  };
}
