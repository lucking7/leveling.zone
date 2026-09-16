import type { EgressSource } from "./types";

function decode(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

const join = (...values: unknown[]) => {
  const cleaned = values
    .filter((value): value is string | number =>
      (typeof value === "string" && value.trim().length > 0) || typeof value === "number",
    )
    .map((value) => decode(String(value).trim()))
    .filter((value, index, entries) => index === 0 || value.toLocaleLowerCase() !== entries[index - 1].toLocaleLowerCase());
  return cleaned.join(", ");
};

const trace = (value: string) =>
  Object.fromEntries(
    value.split(/\r?\n/).map((line) => line.split(/=(.*)/s).slice(0, 2)).filter(([key, entry]) => key && entry !== undefined),
  );

const source = (
  id: string,
  name: string,
  endpoint: string,
  parse: EgressSource["parse"],
  options: Pick<EgressSource, "format" | "enabled" | "expectedFamily" | "referrerPolicy"> = {},
): EgressSource => ({ id, name, endpoint, parse, ...options });

const traceSource = (id: string, name: string, endpoint: string) =>
  source(id, name, endpoint, (value: string) => {
    const data = trace(value);
    return { ip: data.ip, location: data.loc, countryCode: data.loc };
  }, { format: "text" });

// Mirrors the 29 browser-side probes audited from html.zone. Amap stays in the
// inventory but is disabled because it needs a private key and does not return
// the observed address, so it cannot produce a valid egress row.
export const EGRESS_SOURCES: EgressSource[] = [
  source("tencent", "腾讯", "https://r.inews.qq.com/api/ip2city?otype=jsonp", (data) => ({
    ip: data?.ip, network: data?.isp,
    location: join(data?.country, data?.province, data?.city, data?.district),
  }), { format: "jsonp" }),
  source("toutiao", "今日头条", "https://www.toutiao.com/stream/widget/local_weather/data/", ({ data }) => ({
    ip: data?.ip, network: data?.isp,
    location: join(data?.country, data?.province, data?.city, data?.district),
  })),
  source("amap", "高德", "", () => ({}), { enabled: false }),
  source("upyun", "又拍云", "https://pubstatic.b0.upaiyun.com/?_upnode", (data) => ({
    ip: data?.remote_addr, network: data?.remote_addr_location?.isp,
    location: join(data?.remote_addr_location?.country, data?.remote_addr_location?.province, data?.remote_addr_location?.city),
    countryCode: data?.remote_addr_location?.country_code,
  })),
  source("pconline", "PCOnline", "https://whois.pconline.com.cn/ipJson.jsp", (data) => ({
    ip: data?.ip,
    network: typeof data?.addr === "string" ? data.addr.trim().split(/\s+/).at(-1) : undefined,
    location: data?.addr,
  }), { format: "jsonp" }),
  source("zhale", "ZHALE.ME", "https://ipv4cn.zhale.me/ip.php", (data) => {
    const value = typeof data === "string" ? JSON.parse(data) : data;
    return { ip: value?.ip, location: value?.location };
  }, { format: "text", expectedFamily: "ipv4" }),
  source("aliyun-esa", "阿里云 ESA", "https://esa-ip.html.zone/geo", (data) => ({
    ip: data?.ip, network: data?.asOrganization,
    location: join(data?.country, data?.region, data?.city), countryCode: data?.country,
  })),
  source("tencent-esa", "腾讯云 ESA", "https://edge-ip.html.zone/geo", (data) => ({
    ip: data?.ip, network: data?.asOrganization,
    location: join(data?.country, data?.countryRegion, data?.city), countryCode: data?.country,
  })),
  traceSource("visa", "Visa", "https://www.visa.cn/cdn-cgi/trace"),
  traceSource("chatgpt", "ChatGPT", "https://chatgpt.com/cdn-cgi/trace"),
  traceSource("claude", "Claude", "https://claude.ai/cdn-cgi/trace"),
  traceSource("apnic", "APNIC", "https://www.apnic.net/cdn-cgi/trace"),
  source("vercel", "Vercel", "https://vercel-ip.html.zone/geo", (data) => ({
    ip: data?.ip, network: data?.asOrganization,
    location: join(data?.country, data?.countryRegion, data?.city), countryCode: data?.country,
  })),
  source("netlify", "Netlify", "https://netlify-ip.html.zone/geo", (data) => ({
    ip: data?.ip, network: data?.asOrganization,
    location: join(data?.country, data?.countryRegion, data?.city), countryCode: data?.country,
  })),
  source("ipwhois", "ipwho.is", "https://ipwho.is/", (data) => ({
    ip: data?.ip, network: data?.connection?.isp,
    location: join(data?.country, data?.region, data?.city), countryCode: data?.country_code,
  }), { referrerPolicy: "origin" }),
  source("cloudflare", "Cloudflare", "https://speed.cloudflare.com/meta", (data) => ({
    ip: data?.clientIp, network: data?.asOrganization,
    location: join(data?.country, data?.region, data?.city), countryCode: data?.country,
  })),
  source("cloudflare-v4", "Cloudflare IPv4", "https://cloudflare-ip-v4.html.zone/geo", (data) => ({
    ip: data?.ip, network: data?.asOrganization,
    location: join(data?.country, data?.countryRegion, data?.city), countryCode: data?.country,
  }), { expectedFamily: "ipv4" }),
  source("cloudflare-v6", "Cloudflare IPv6", "https://cloudflare-ip-v6.html.zone/geo", (data) => ({
    ip: data?.ip, network: data?.asOrganization,
    location: join(data?.country, data?.countryRegion, data?.city), countryCode: data?.country,
  }), { expectedFamily: "ipv6" }),
  source("ipsb-v4", "IP.SB IPv4", "https://api-ipv4.ip.sb/geoip", (data) => ({
    ip: data?.ip, network: data?.organization,
    location: join(data?.country, data?.region, data?.city), countryCode: data?.country_code,
  }), { expectedFamily: "ipv4" }),
  source("ipsb-v6", "IP.SB IPv6", "https://api-ipv6.ip.sb/geoip", (data) => ({
    ip: data?.ip, network: data?.organization,
    location: join(data?.country, data?.region, data?.city), countryCode: data?.country_code,
  }), { expectedFamily: "ipv6" }),
  source("zxinc-v4", "ZXINC IPv4", "https://v4.ip.zxinc.org/info.php?type=json", (data) => ({
    ip: data?.data?.myip, location: data?.data?.location,
  }), { expectedFamily: "ipv4" }),
  source("zxinc-v6", "ZXINC IPv6", "https://v6.ip.zxinc.org/info.php?type=json", (data) => ({
    ip: data?.data?.myip, location: data?.data?.location,
  }), { expectedFamily: "ipv6" }),
  source("ident-v4", "ident.me IPv4", "https://v4.ident.me/json", (data) => ({
    ip: data?.ip, network: data?.aso,
    location: join(data?.country, data?.region, data?.city), countryCode: data?.cc,
  }), { expectedFamily: "ipv4" }),
  source("ident-v6", "ident.me IPv6", "https://v6.ident.me/json", (data) => ({
    ip: data?.ip, network: data?.aso,
    location: join(data?.country, data?.region, data?.city), countryCode: data?.cc,
  }), { expectedFamily: "ipv6" }),
  source("browserscan", "browserscan.com", "https://ip-scan.browserscan.net/sys/config/ip/get-visitor-ip?type=ip-api", ({ data = {} }) => ({
    ip: data?.ip, network: data?.ip_data?.isp,
    location: join(data?.ip_data?.country, data?.ip_data?.region, data?.ip_data?.city),
    countryCode: data?.ip_data?.country,
  })),
  source("surfshark", "surfshark.com", "https://surfshark.com/api/v1/server/user", (data) => ({
    ip: data?.ip, network: data?.isp,
    location: join(data?.country, data?.region, data?.city), countryCode: data?.countryCode,
  })),
  source("ipquery", "ipquery.io", "https://api.ipquery.io/?format=json", (data) => ({
    ip: data?.ip, network: data?.isp?.isp,
    location: join(data?.location?.country, data?.location?.state, data?.location?.city),
    countryCode: data?.location?.country_code,
  })),
  source("ipapi-is", "ipapi.is", "https://api.ipapi.is", (data) => ({
    ip: data?.ip, network: data?.asn?.org,
    location: join(data?.location?.country, data?.location?.state, data?.location?.city),
    countryCode: data?.location?.country_code,
  })),
  source("apip-cc", "apip.cc", "https://apip.cc/json", (data) => ({
    ip: data?.query, network: join(data?.asn, data?.org),
    location: join(data?.CountryName, data?.RegionName, data?.City), countryCode: data?.CountryCode,
  })),
];
