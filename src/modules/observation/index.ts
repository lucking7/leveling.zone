import { observeExternalIp } from './engine';
import { OBSERVATION_ADAPTERS } from './sources';

export { resolveRequestIp, type RequestIpSource, type ResolvedRequestIp } from './request-ip';
export type {
  ObservationFailure,
  ObservationResult,
  ObservationScope,
  ObservationSourceData,
  ObservationSummary,
} from './types';

export function observeRequestIp(requestedIp: string) {
  return observeExternalIp({ requestedIp, adapters: OBSERVATION_ADAPTERS });
}
