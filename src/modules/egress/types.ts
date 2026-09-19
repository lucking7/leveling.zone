import type { IpFamily } from "../../lib/ip-address";
export type { IpFamily } from "../../lib/ip-address";

export interface EgressResult {
  id: string;
  name: string;
  ip: string;
  family: IpFamily;
  network: string;
  location: string;
  countryCode?: string;
}

export interface ParsedEgressResult {
  ip?: unknown;
  network?: unknown;
  location?: unknown;
  countryCode?: unknown;
}

export interface EgressSource {
  id: string;
  name: string;
  endpoint: string;
  format?: "json" | "text" | "jsonp";
  enabled?: boolean;
  expectedFamily?: IpFamily;
  referrerPolicy?: ReferrerPolicy;
  parse: (value: any) => ParsedEgressResult;
}
