export interface RdapNetwork {
  handle: string;
  name: string;
  type: string;
  startAddress: string;
  endAddress: string;
  ipVersion: string;
  country: string;
  parentHandle: string;
  cidrs: string[];
}

export interface RdapEntity {
  handle: string;
  name: string;
  roles: string[];
  emails: string[];
  phones: string[];
  address: string;
}

export interface RdapEvent {
  action: string;
  date: string;
}

export interface RdapTextBlock {
  title: string;
  description: string[];
}

export interface RdapLink {
  title: string;
  href: string;
}

export interface RdapResult {
  ip: string;
  registry: string;
  endpoint: string;
  network: RdapNetwork;
  entities: RdapEntity[];
  events: RdapEvent[];
  remarks: RdapTextBlock[];
  notices: RdapTextBlock[];
  links: RdapLink[];
  raw: Record<string, unknown>;
}

export type RdapErrorCode =
  | 'INVALID_IP'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'UPSTREAM_TIMEOUT';
