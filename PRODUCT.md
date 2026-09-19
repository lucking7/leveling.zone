# ORBIT / 地址观测

<!-- impeccable:product-schema 1 -->

## Platform

Web application built with Next.js App Router, React, and TypeScript, plus an independent Python database updater. Runtime lookup and RDAP routes require the Node.js runtime.

## Users

People who need to inspect an IPv4 or IPv6 address, compare actual GeoIP sources, see the public address exposed by their current connection, or read authoritative IP network registration data.

## Product Purpose

ORBIT turns an IP address into a source-labelled record of estimated location, network ownership, and RDAP registration. Success means the user can identify which source produced a value, distinguish missing or failed data from facts, copy the underlying response, and recover from a failed lookup without losing a previous successful result.

## Routes and Capabilities

- `/` and `/geoip` provide the GeoIP lookup surface; `/geoip/[ip]` is the shareable result route. `/ip/query?ip=…` remains a compatibility redirect to the root query route.
- GeoIP accepts literal IPv4 and IPv6 addresses, reads installed local databases, can query configured external providers for public addresses, and keeps `external=false` compatibility for local-only requests. Non-public addresses never go to external providers.
- GeoIP omits empty sources from the visible selector, chooses the usable source with the richest returned record for the initial summary, exposes other real sources, and preserves the complete normalized JSON. `ok`, `partial`, and complete `503` responses remain meaningful.
- `/myip` displays only the address the trusted entry layer exposes for the current request. It queries local databases with external providers disabled; every returned source must match that visitor IP, use `request-ip` scope, and report zero server-egress sources. It never falls back to the deployment host's egress address.
- `/egress` checks the addresses observed by multiple websites through browser-side requests after the user starts a check. Results preserve each service's actual address, network and estimated location, including separate IPv4/IPv6 endpoints. Unsuccessful sources disappear; an all-empty run offers retry. This is not an account-access or AI-service-unlock test, and the server must never substitute its own egress address.
- `/whois` and `/whois/[ip]` query real RDAP data for literal IPv4 or IPv6 addresses. The UI renders available network range, CIDR, handle, name, type, country, parent, events, public contacts, links, remarks, notices, registry, endpoint, and Raw RDAP JSON. It does not claim domain or ASN search and does not fabricate port-43 Whois text.
- Chinese and English interface copy switches immediately and persists in `orbit.locale`. Light is the default theme; the optional dark theme persists in `orbit.theme`.
- Copy actions, retry paths, loading and stale-result states, accessible labels, live regions, keyboard focus, and mobile navigation are product behavior, not decorative extras.

## RDAP Safety Contract

The server selects an endpoint from the IANA IPv4 or IPv6 bootstrap registry using longest-prefix matching. Outbound record requests are HTTPS-only and limited to the exact known base paths of AFRINIC, APNIC, ARIN, RIPE NCC, and LACNIC. Redirects are manual, limited to three, and accepted only when the destination stays on the five-host allowlist and names the same normalized address.

Each upstream request has a five-second timeout, the complete server lookup has a twelve-second deadline, and a response cannot exceed 2 MiB. A successful response must be an IP network object whose start/end range contains the queried address. The browser applies its own fifteen-second timeout, validates the response shape and exact IP, and surfaces sanitized invalid-input, not-found, rate-limit, upstream, timeout, malformed-response, and network failures.

## Database and Deployment Constraints

- `config/databases.json` is the updater's source of truth. The updater downloads and validates the selected database set as one immutable snapshot, writes a manifest and checksums, and atomically switches `data/db/current`; a failed update keeps the active version.
- The application resolves one database directory per request and does not combine files from different snapshots. Missing databases produce partial results or an unavailable response instead of guessed data. Readers notice a validated version switch on a later query without requiring an application restart.
- Verified public GitHub Releases can distribute complete database snapshots. Host and Docker workflows are supported. Deployment readiness and the state of any particular server require separate runtime evidence; this document does not claim that a target is deployed.
- Vercel and Blob support are outside the current deployment model. Database files and credentials must remain outside public static paths and Git history.

## Privacy and Data Integrity

- GeoIP is an estimate. The UI must not describe a city, coordinate, organization, or country as a precise device or datacenter location.
- A public GeoIP query may send the entered IP to configured external providers unless the request uses `external=false`. Non-public targets remain local. `/myip` always uses local databases only.
- The reverse proxy must overwrite trusted client-address headers; the application must not trust an arbitrary forwarding header supplied by a visitor.
- The product does not add a recent-query feed, sample results, analytics claims, or a promise of zero infrastructure logging. Raw responses and copied JSON retain source values without translating or merging them into invented facts.
- Missing security, ownership, registration, or location fields mean unknown or unavailable. They do not imply safety, absence, or a negative result.

## Brand Commitments

The displayed name remains **ORBIT / 地址观测**. The current product is a lightweight, narrow, IP.SB-referenced utility: white default canvas, optional dark theme, self-hosted Space Grotesk and OpenTUI Mono, 12px bordered record panels, and no shadows. The previous ASCII globe, serif-led editorial world, advertisements, example shortcuts, and fictional recent history are no longer rendered commitments. The portable visual specification is the lowercase canonical [design.md](design.md); the route-specific brief is [IP.SB direction](docs/design/ip-sb-direction.md).

## Product Principles

- Show the requested address and its source before interpretation.
- Prefer one coherent real-source summary while keeping source comparison and raw data available.
- Preserve the last valid result when a new request fails, and label it as previous rather than current.
- Omit unavailable fields and empty sources without manufacturing replacements.
- Keep lookup, copy, retry, source selection, theme, locale, and navigation usable at 320px and with keyboard or assistive technology.
- Treat actual runtime queries, network policy checks, and rendered browser scenarios as acceptance evidence. Static types, build output, or screenshots alone prove only their own layer.

## Evidence on Hand

- Current UI behavior: `src/components/workspace.tsx`, `src/components/geo-lookup.tsx`, `src/components/whois-lookup.tsx`, and `src/app/myip/page.tsx`.
- Query, visitor, and RDAP contracts: `src/modules/query`, `src/modules/query/visitor.ts`, and `src/modules/rdap`.
- Database lifecycle and deployment procedures: `README.md`, `docs/database-updates.md`, and `docs/deployment/`.
- Route-level direction and acceptance criteria: [IP.SB direction](docs/design/ip-sb-direction.md). Historical local review captures are not current build or deployment evidence.
