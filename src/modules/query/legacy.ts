import type { QueryResult, SourceResult } from './types';

const number = (s?: SourceResult) => s?.network.asn ? Number(s.network.asn.slice(2)) : undefined;
const place = (s?: SourceResult) => s && ({
  country: s.location.country, region: s.location.region, city: s.location.city,
  continent: s.location.continent,
  location: { ...s.location, zipcode: s.location.postalCode },
  asn: number(s), asnOrg: s.network.organization,
});
/** Old response names and shapes belong to this adapter, never to reader implementations. */
export function legacy(result: QueryResult) {
  const s = result.sources;
  const entries = Object.values(s);
  const first = <T>(select: (value: SourceResult) => T | undefined) =>
    entries.map(select).find(value => value !== undefined && value !== '');
  const selectedLocation = first(value => value.location.latitude !== undefined && value.location.longitude !== undefined ? value.location : undefined);
  const location = {
    latitude: selectedLocation?.latitude, longitude: selectedLocation?.longitude,
    timezone: first(value => value.location.timezone), zipcode: first(value => value.location.postalCode),
  };
  const flags = first(value => value.security);
  const dbip = s.dbip && {
    ...place(s.dbip), country: s.dbip.location.countryCode,
    country_names: { en: s.dbip.location.country },
    continent: { names: { en: s.dbip.location.continent } },
    is_eu: s.dbip.security?.isEU,
  };
  const qqwry = s.qqwry && {
    country: s.qqwry.location.country, region: s.qqwry.location.region, city: s.qqwry.location.city,
    district: s.qqwry.location.district, isp: s.qqwry.network.isp, organization: s.qqwry.network.organization,
  };
  const geoCn = s.geocn && {
    ...place(s.geocn), province: s.geocn.location.region, district: s.geocn.location.district,
    isp: s.geocn.network.isp,
  };
  return {
    ...result,
    country: first(value => value.location.country), city: first(value => value.location.city),
    region: first(value => value.location.region), continent: first(value => value.location.continent),
    asn: first(value => number(value)), asnOrg: first(value => value.network.organization),
    location,
    network: {
      network: first(value => value.network.route),
      isp: first(value => value.network.isp), domain: first(value => value.network.domain),
      proxy: flags?.isProxy, proxyType: flags?.proxyType, threat: flags?.threat,
    },
    maxmind: s.maxmind ? { ...place(s.maxmind), network: s.maxmind.network.route } : null,
    dbip,
    ip2location: s.ip2location && {
      ...place(s.ip2location), as: s.ip2location.network.organization,
      proxy: s.ip2location.security && { ...s.ip2location.security },
    },
    ipinfo: s.ipinfo && { ...place(s.ipinfo), asDomain: s.ipinfo.network.domain },
    iptoasn: s.iptoasn && { asn: number(s.iptoasn), asnOrg: s.iptoasn.network.organization },
    qqwry: qqwry || null, geocn: geoCn, geoCn: geoCn || null,
    asnInfo: s.asnInfo && {
      number: s.asnInfo.network.asn?.slice(2), name: s.asnInfo.network.handle,
      org: s.asnInfo.network.description,
    },
    source: entries.map(value => value.label),
  };
}
