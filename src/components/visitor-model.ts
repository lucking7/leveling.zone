import type { SourceResult } from "@/modules/query/types";
import type { ObservationFailureReason, ObservationSummary } from "@/modules/observation/types";
import { isRecord, isSourceResult } from "./source-model";

export type VisitorSource = SourceResult & {
  ip: string;
  observation: { scope: "request-ip"; source: string };
};

export interface ObservationEnvelope {
  ip: string;
  ipSource: string;
  sources: Record<string, VisitorSource>;
  observation: ObservationSummary;
  generation?: string;
  timestamp?: string;
  error?: string;
}

const FAILURE_REASONS: readonly ObservationFailureReason[] = [
  "timeout",
  "http-error",
  "invalid-response",
  "network-error",
  "lookup-failed",
  "not-installed",
];

function isObservation(value: unknown): value is ObservationEnvelope {
  if (
    !isRecord(value) ||
    typeof value.ip !== "string" ||
    !value.ip ||
    typeof value.ipSource !== "string" ||
    !isRecord(value.sources) ||
    !isRecord(value.observation) ||
    value.observation.semantics !== "request-ip" ||
    !Array.isArray(value.observation.failures)
  ) {
    return false;
  }

  const requestCount = value.observation.requestIpSourceCount;
  const egressCount = value.observation.serverEgressSourceCount;
  if (
    typeof requestCount !== "number" ||
    !Number.isInteger(requestCount) ||
    requestCount < 0 ||
    egressCount !== 0
  ) {
    return false;
  }

  if (!value.observation.failures.every(failure => isRecord(failure) &&
    typeof failure.source === "string" && typeof failure.reason === "string" &&
    FAILURE_REASONS.some(reason => reason === failure.reason))) return false;

  for (const source of Object.values(value.sources)) {
    if (!isSourceResult(source) || !isRecord(source) ||
      source.ip !== value.ip || !isRecord(source.observation) ||
      source.observation.scope !== "request-ip" ||
      typeof source.observation.source !== "string" || !source.observation.source) return false;
  }
  if (Object.keys(value.sources).length !== requestCount) return false;
  if ([value.generation, value.timestamp, value.error].some(item => item !== undefined && typeof item !== "string")) return false;

  return true;
}

export function parseObservation(value: unknown): ObservationEnvelope | null {
  // Copying retains the complete validated response, including source labels and provenance.
  return isObservation(value) ? value : null;
}
