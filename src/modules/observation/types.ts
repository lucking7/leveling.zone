export type ObservationFailureReason =
  | 'timeout'
  | 'http-error'
  | 'invalid-response'
  | 'network-error'
  | 'lookup-failed'
  | 'not-installed';

export interface ObservationFailure {
  source: string;
  reason: ObservationFailureReason;
}

export interface ObservationSummary {
  semantics: 'request-ip';
  requestIpSourceCount: number;
  serverEgressSourceCount: 0;
  failures: ObservationFailure[];
}
