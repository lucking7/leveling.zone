export interface SourceResult {
  label: string;
  location: {
    country?: string; countryCode?: string; region?: string; city?: string; district?: string; divisionCode?: string;
    continent?: string; latitude?: number; longitude?: number; timezone?: string; postalCode?: string;
  };
  network: { asn?: string; organization?: string; isp?: string; domain?: string; route?: string; handle?: string; description?: string };
  security?: Record<string, string | number | boolean>;
}
export interface QueryResult {
  ip: string;
  sources: Record<string, SourceResult>;
  errors: Record<string, string>;
  status: 'ok' | 'partial' | 'unavailable';
  generation: string;
  timestamp: string;
}
