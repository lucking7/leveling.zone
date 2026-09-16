export type ObservationScope = 'request-ip' | 'server-egress';

export type ObservationFailureReason =
  | 'timeout'
  | 'http-error'
  | 'invalid-response'
  | 'network-error'
  | 'lookup-failed'
  | 'not-installed';

export interface ObservationProvenance {
  scope: ObservationScope;
  source: string;
}

export interface ObservationSourceData {
  ip?: string;
  location?: Record<string, unknown>;
  network?: Record<string, unknown>;
  security?: Record<string, unknown>;
  accuracy?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  observation: ObservationProvenance;
}

export interface ObservationFailure {
  source: string;
  reason: ObservationFailureReason;
}

export interface ObservationSummary {
  semantics: 'mixed' | 'request-ip';
  requestIpSourceCount: number;
  serverEgressSourceCount: number;
  failures: ObservationFailure[];
}

export interface ObservationResult {
  sources: Record<string, ObservationSourceData>;
  observation: ObservationSummary;
}

export interface ObservationRequestContext {
  requestedIp: string;
  request(url: string, init?: RequestInit): Promise<Response>;
}

export interface ObservationAdapter {
  key: string;
  name: string;
  scope: ObservationScope;
  enabled?: () => boolean;
  observe(context: ObservationRequestContext): Promise<Omit<ObservationSourceData, 'observation'> | null>;
}
