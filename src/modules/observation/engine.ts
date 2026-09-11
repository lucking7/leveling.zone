import type {
  ObservationAdapter,
  ObservationFailureReason,
  ObservationResult,
  ObservationSourceData,
} from './types';

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_CONCURRENCY = 6;

class ObservationHttpError extends Error {}
class ObservationResponseError extends Error {}

export function invalidObservationResponse(message = 'Invalid observation response'): never {
  throw new ObservationResponseError(message);
}

export async function requireOk(response: Response): Promise<Response> {
  if (!response.ok) {
    throw new ObservationHttpError(`Observation source returned HTTP ${response.status}`);
  }
  return response;
}

function failureReason(error: unknown, timedOut: boolean): ObservationFailureReason {
  if (timedOut || (error instanceof DOMException && error.name === 'AbortError')) {
    return 'timeout';
  }
  if (error instanceof ObservationHttpError) return 'http-error';
  if (error instanceof ObservationResponseError || error instanceof SyntaxError) {
    return 'invalid-response';
  }
  return 'network-error';
}

interface ObserveOptions {
  requestedIp: string;
  adapters: readonly ObservationAdapter[];
  fetcher?: typeof fetch;
  timeoutMs?: number;
  concurrency?: number;
}

type AdapterOutcome =
  | { key: string; data: ObservationSourceData }
  | { key: string; source: string; reason: ObservationFailureReason }
  | { key: string; skipped: true };

async function runAdapter(
  adapter: ObservationAdapter,
  requestedIp: string,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<AdapterOutcome> {
  if (adapter.enabled && !adapter.enabled()) {
    return { key: adapter.key, skipped: true };
  }

  const controller = new AbortController();
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const operation = adapter.observe({
      requestedIp,
      request: (url, init = {}) => {
        if (controller.signal.aborted) {
          throw new DOMException('Observation deadline exceeded', 'AbortError');
        }
        return fetcher(url, { ...init, signal: controller.signal });
      },
    }).then<AdapterOutcome>((data) => {
      if (!data) {
        return { key: adapter.key, source: adapter.name, reason: 'invalid-response' };
      }
      return {
        key: adapter.key,
        data: {
          ...data,
          observation: { scope: adapter.scope, source: adapter.name },
        },
      };
    }).catch<AdapterOutcome>((error: unknown) => ({
      key: adapter.key,
      source: adapter.name,
      reason: failureReason(error, timedOut),
    }));

    const deadline = new Promise<AdapterOutcome>((resolve) => {
      timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
        resolve({ key: adapter.key, source: adapter.name, reason: 'timeout' });
      }, timeoutMs);
    });

    return await Promise.race([operation, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function observeExternalIp({
  requestedIp,
  adapters,
  fetcher = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  concurrency = DEFAULT_CONCURRENCY,
}: ObserveOptions): Promise<ObservationResult> {
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), adapters.length || 1));
  const outcomes: Array<AdapterOutcome | undefined> = new Array(adapters.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < adapters.length) {
      const index = nextIndex++;
      outcomes[index] = await runAdapter(adapters[index], requestedIp, fetcher, timeoutMs);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const sources: Record<string, ObservationSourceData> = {};
  const failures: ObservationResult['observation']['failures'] = [];
  let requestIpSourceCount = 0;
  let serverEgressSourceCount = 0;

  for (const outcome of outcomes) {
    if (!outcome || 'skipped' in outcome) continue;
    if ('data' in outcome) {
      sources[outcome.key] = outcome.data;
      if (outcome.data.observation.scope === 'request-ip') requestIpSourceCount += 1;
      else serverEgressSourceCount += 1;
    } else {
      failures.push({ source: outcome.source, reason: outcome.reason });
    }
  }

  return {
    sources,
    observation: {
      semantics: 'mixed',
      requestIpSourceCount,
      serverEgressSourceCount,
      failures,
    },
  };
}
