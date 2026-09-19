# Query and egress sources

The runtime registry, rather than a copied website description, defines the available integrations. Implemented does not mean every provider is reachable from every network.

## Specified IP queries

Eight local logical sources are supplemented by 25 online adapters. Local sources are MaxMind, DB-IP, QQWry, GeoCN, IPinfo, IPtoASN, IP2Location and ASN Info. The 14 installed files are not 14 independent query providers.

The online catalog retains seven compatible IDs and adds all 18 gaps from the HTML.ZONE audit. Requests are public-IP-only, run with at most eight workers, and have a four-second deadline per provider including fallbacks and response parsing. Returned IPs must match the requested IP; an echoed IP alone is not usable GeoIP data. Source failures remain in API errors and disappear from the visible selector.

| ID | Provider | Transport |
| --- | --- | --- |
| ipbase | ipbase.com | direct |
| ipdata | ipdata.co | html.zone relay |
| ipquery | ipquery.io | direct |
| ipregistry | ipregistry.co | html.zone relay |
| ip2location_io | ip2location.io | html.zone relay |
| dbip_demo | DB-IP online | direct |
| ipinfo_demo | IPinfo online | direct |
| baidu_open | Baidu Open Platform | html.zone relay |
| baidu_qifu | Baidu Qifu | direct |
| baidu_qifu_backup | Baidu Qifu backup | direct |
| taobao | Taobao | html.zone relay |
| cz88 | CZ88 official API | direct |
| ipip | IPIP database | html.zone relay |
| amap | AMap | direct |
| zxinc | ZXINC | direct |
| pconline | PCOnline | direct |
| zhale | ZHALE.ME | direct |
| ipsb | IP.SB | direct |
| ipapi_co | ipapi.co | direct |
| ip_api | ip-api.com | html.zone relay |
| ipwhois | ipwho.is | direct |
| ipgeolocation | ipgeolocation.io | html.zone relay |
| freeipapi | freeipapi.com | direct |
| ipapi_is | ipapi.is | direct |
| apip_cc | apip.cc | direct |

IPinfo tries its public JSON endpoint before its demo fallback. IP2Location tries the existing HTML.ZONE JSON relay before its compatible HTML fallback. These relays are third-party dependencies, not an ORBIT Vercel deployment. AMap requires a separately provisioned `AMAP_API_KEY`; absent credentials produce zero upstream requests. This release does not provision that key. Never reuse the reference site’s embedded key.

Provider-specific business failure codes are rejected even when the response contains data. PCOnline bodies are decoded as GBK before JSONP parsing. ZXINC and PCOnline return unstructured location descriptions. They are retained in `location.description`, not mislabelled as a structured region.

## Browser egress checks

`/egress` performs direct browser requests after explicit start, with six workers, an eight-second per-source deadline and a hard worker cap of eight. There is no server proxy or server-address fallback. IPv4/IPv6-specific endpoints reject the other address family; valid IP-only echo results are meaningful here. Locale/theme changes do not refetch, new runs clear old results, and leaving the page aborts requests and cleans up JSONP callbacks.

| Probe | Status |
| --- | --- |
| 腾讯 | Registered browser probe |
| 今日头条 | Registered browser probe |
| 高德 | Disabled: no observed IP and no public credential configured |
| 又拍云 | Registered browser probe |
| PCOnline | Registered browser probe |
| ZHALE.ME | Registered browser probe |
| 阿里云 ESA | Registered browser probe |
| 腾讯云 ESA | Registered browser probe |
| Visa | Registered browser probe |
| ChatGPT | Registered browser probe |
| Claude | Registered browser probe |
| APNIC | Registered browser probe |
| Vercel | Registered browser probe |
| Netlify | Registered browser probe |
| ipwho.is | Registered browser probe |
| Cloudflare | Registered browser probe |
| Cloudflare IPv4 | Registered browser probe |
| Cloudflare IPv6 | Registered browser probe |
| IP.SB IPv4 | Registered browser probe |
| IP.SB IPv6 | Registered browser probe |
| ZXINC IPv4 | Registered browser probe |
| ZXINC IPv6 | Registered browser probe |
| ident.me IPv4 | Registered browser probe |
| ident.me IPv6 | Registered browser probe |
| browserscan.com | Registered browser probe |
| surfshark.com | Registered browser probe |
| ipquery.io | Registered browser probe |
| ipapi.is | Registered browser probe |
| apip.cc | Registered browser probe |

The registry has 29 entries, of which 28 are enabled. AMap does not return an observed egress IP and remains disabled. Cloudflare trace endpoints for Visa, ChatGPT, Claude and APNIC report connection IP/location only; they are not account-access or service-unlock checks. CORS, network routing, IPv6 connectivity and upstream limits can cause probes to disappear.

`/myip` remains a separate visitor-only local lookup with zero server-egress sources. No upstream list can turn the JP deployment address into the visitor’s address.

## Verification

Run `npm test` for provider parsing, query policy and browser-runner regression tests. Verify rendered states in a running production build separately. Mock fixtures prove behavior under controlled success/failure conditions; historical local captures and real source counts are snapshots, not current deployment or availability guarantees.
