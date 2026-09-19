import { ipFamily } from "../../lib/ip-address";
export { ipFamily } from "../../lib/ip-address";
import type { EgressResult, EgressSource, ParsedEgressResult } from "./types";

export type EgressFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type JsonpRequester = (source: EgressSource, signal: AbortSignal) => Promise<unknown>;

export interface RunEgressOptions {
  sources: EgressSource[];
  signal: AbortSignal;
  fetcher?: EgressFetcher;
  jsonp?: JsonpRequester;
  concurrency?: number;
  timeoutMs?: number;
  onResult?: (result: EgressResult) => void;
  onSettled?: () => void;
}

function abortError() {
  return new DOMException("Aborted", "AbortError");
}

function scalar(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

export function normalizeEgressResult(source: EgressSource, value: ParsedEgressResult): EgressResult {
  const ip = scalar(value.ip);
  const family = ipFamily(ip);
  if (!family || (source.expectedFamily && source.expectedFamily !== family)) throw new Error("invalid response");
  const countryCode = scalar(value.countryCode).toLowerCase();
  return {
    id: source.id,
    name: source.name,
    ip,
    family,
    network: scalar(value.network),
    location: scalar(value.location),
    ...(countryCode && { countryCode }),
  };
}

export function createJsonpRequest(source: EgressSource, signal: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const callback = `orbitEgress_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const separator = source.endpoint.includes("?") ? "&" : "?";
    let settled = false;
    const cleanup = () => {
      delete (window as unknown as Record<string, unknown>)[callback];
      script.remove();
      signal.removeEventListener("abort", abort);
    };
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      action();
    };
    const abort = () => finish(() => reject(abortError()));
    (window as unknown as Record<string, unknown>)[callback] = (value: unknown) => finish(() => resolve(value));
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.src = `${source.endpoint}${separator}callback=${encodeURIComponent(callback)}`;
    script.onerror = () => finish(() => reject(new Error("request failed")));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    else document.head.append(script);
  });
}

async function raceWithDeadline<T>(operation: () => Promise<T>, controller: AbortController, parentSignal: AbortSignal, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      parentSignal.removeEventListener("abort", parentAbort);
      action();
    };
    const parentAbort = () => {
      controller.abort();
      finish(() => reject(abortError()));
    };
    const timer = globalThis.setTimeout(() => {
      controller.abort();
      finish(() => reject(new DOMException("Deadline exceeded", "TimeoutError")));
    }, timeoutMs);
    parentSignal.addEventListener("abort", parentAbort, { once: true });
    if (parentSignal.aborted) parentAbort();
    else operation().then((value) => finish(() => resolve(value)), (error) => finish(() => reject(error)));
  });
}

export async function fetchEgressSource(source: EgressSource, options: {
  signal: AbortSignal;
  fetcher?: EgressFetcher;
  jsonp?: JsonpRequester;
  timeoutMs?: number;
}): Promise<EgressResult> {
  if (source.enabled === false || !source.endpoint) throw new Error("source disabled");
  const controller = new AbortController();
  const value = await raceWithDeadline(async () => {
    if (source.format === "jsonp") return (options.jsonp ?? createJsonpRequest)(source, controller.signal);
    const response = await (options.fetcher ?? fetch)(source.endpoint, {
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: source.referrerPolicy ?? "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("request failed");
    const body = await response.text();
    return source.format === "text" ? body : JSON.parse(body);
  }, controller, options.signal, options.timeoutMs ?? 8000);
  return normalizeEgressResult(source, source.parse(value));
}

export async function runEgressSources(options: RunEgressOptions): Promise<EgressResult[]> {
  const results: EgressResult[] = [];
  let cursor = 0;
  const limit = Math.max(1, Math.min(options.concurrency ?? 6, 8));
  async function worker() {
    while (cursor < options.sources.length) {
      if (options.signal.aborted) throw abortError();
      const source = options.sources[cursor++];
      try {
        const result = await fetchEgressSource(source, options);
        results.push(result);
        options.onResult?.(result);
      } catch (error) {
        if (options.signal.aborted) throw abortError();
      } finally {
        options.onSettled?.();
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, options.sources.length) }, worker));
  return results;
}
