# HTML.ZONE source alignment

2026-09-13. Implements the gaps recorded in [the comparison](../research/html-zone-api-comparison.md), while retaining Orbit’s established visual system.

## Delivered

- Specified-IP lookup: all 18 missing integrations, 25 online sources in total, alongside eight local source families. Eight providers use HTML.ZONE relays, documented in the [source inventory](../query-sources.md).
- Browser egress: `/egress`, 29 registered probes and 28 enabled probes. Requests originate in the visitor’s browser, start only on demand, and never fall back to the deployment host.
- Shared desktop/mobile navigation, Lucide icons, bilingual labels, theme support, compact table, country flags based on returned location, copy and GeoIP links.
- Stable result order, bounded concurrency, loading/partial/empty/retry states. Failed probes are omitted. Language/theme changes preserve results without new requests.
- Source selector and raw data retain existing interaction, with table captions and keyboard-accessible raw output. Unstructured locations use `location.description`.
- Successful business envelopes, matching echoed addresses and useful records are required. PCOnline uses GBK decoding. AMap cannot fabricate a China result from empty province/city fields.

## Acceptance

60 Node tests and TypeScript checks passed. Browser regressions passed: 15 header groups, 17 GeoIP/Whois/My IP groups and seven egress groups. Egress checks cover 320/390/768/769/1440 widths, 44px touch targets, long IPv6 values, light/dark themes and deterministic success/failure/retry fixtures. Linux standalone production build passed before release activation.

Evidence: `.impeccable/review/source-alignment/egress/checks.json`, screenshots in the same directory, and the deployed query snapshot in `.impeccable/review/source-alignment/deployed.json`.

Public JP validation returned 25 sources for IPv4 and 20 for IPv6 (including local databases). The real browser egress run returned 21 rows at 390px with no horizontal overflow. `/myip` returned seven visitor sources and zero server-egress sources. These are point-in-time results.

## Limits

Registration is not an availability guarantee. CORS, IPv6 connectivity, geography and upstream limits affect live results. AMap specified-IP lookup awaits a separately provisioned key; the egress entry remains disabled because it supplies no observed IP. No embedded reference-site credentials were copied. Cloudflare trace probes do not establish account access or service unlocking. Mobile acceptance uses Chromium emulation, not a physical iPhone/Safari run.

`/myip` retains visitor-only local database semantics. Production database files and snapshot are unchanged. Public HTTP access retains the existing clipboard limitation.
