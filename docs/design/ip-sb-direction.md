# IP.SB reference redesign

User-approved direction (2026-09-12): use Ego Lite to reference `https://ip.sb/geoip/` and `https://ip.sb/whois/8.8.8.8` one-to-one. This replaces the prior ORBIT ASCII globe and serif visual world on the query website. No concept alternatives are needed because the user pinned concrete references.

## Surface mode

**Operate.** The visitor's primary job on GeoIP, My IP, and Whois is to enter or inspect an address, read a source-labelled result, copy useful values, compare sources, and recover from errors. Scanability, accurate provenance, direct controls, and stable record geometry outrank decorative expression. This mode applies to these lookup surfaces, not to the product as a whole.

## Visual contract

Use a white/light default with optional dark mode. The 56px full-width header has a thin bottom border, ORBIT wordmark, My IP, GeoIP, and Whois navigation, GitHub link, quick search, language action, theme action, and mobile menu. The content container is 920px including 32px desktop side padding, yielding 856px panels. At mobile widths, use 20px gutters and disclose the navigation beneath the header row.

Space Grotesk is a self-hosted variable font under the SIL OFL. The user-selected OpenTUI Mono is self-hosted for inputs, search actions, IP titles, technical values and JSON. Ordinary interface text remains Space Grotesk. Do not use unlicensed Berkeley Mono or the retired serif display font.

The GeoIP empty viewport centers a 34px title above a 560px maximum pill search with 52px controls and a muted explanation. A result uses the compact full-width search, explicit selected-source provenance, an address/location panel, and a network panel. Whois uses a 24px title, the same search pattern, structured network range, CIDR, handle, name, type, country, parent, event, contact, registry, endpoint, notice, link, and Raw RDAP JSON fields when present. Panels use 12px corners, one-pixel `#e5e5e5` light-theme borders, and no shadows. Desktop rows use 200px labels and a 16px gap; mobile rows stack labels above values.

Existing multi-source GeoIP and My IP data remains available. One actual source drives the visible summary so the interface never merges values into a fictional combined record. Additional sources appear as selectors and in a disclosure with full JSON.

## Product constraints

Retain the ORBIT brand, bilingual state, light/dark persistence, actual local database queries, optional public-IP external queries, visitor-only My IP semantics, copy and retry actions, complete JSON, silent omission of empty sources, and explicit stale-result labels. Do not reproduce reference ads, third-party branding or copyright, example addresses, global recent history, PTR fields, or registered-country facts that the product does not have. Only render functional navigation links. The prior globe is not rendered on these pages.

Whois uses real RDAP registration data. IANA bootstrap selects among the authoritative AFRINIC, APNIC, ARIN, RIPE NCC, and LACNIC endpoints. Requests support IPv4 and IPv6 literals only; domain and ASN search are not claimed. Use HTTPS allowlisting, at most three same-address RIR redirects, a five-second upstream timeout, a twelve-second total server deadline, a 2 MiB response cap, and returned-network range validation. The browser applies a fifteen-second timeout. Label raw output as RDAP JSON and surface not-found, rate-limit, timeout, malformed, and upstream failures honestly.

`/myip` shows only the address the current connection exposes to the trusted entry layer, queries local databases with external providers disabled, and requires every result row to match that address with `request-ip` scope. It must never substitute a server-egress address. Public GeoIP external mode may send the entered public IP to configured third parties; non-public targets remain local.

Do not claim deployment status from local implementation or tests. Host, Docker, database snapshot, and target-server status require their own runtime evidence. Keep databases and credentials outside public static paths and Git history.

## Evidence and acceptance

Ego Lite TaskSpace 23 inspected both reference routes, the GeoIP result for `8.8.8.8`, and the 390px mobile layouts. Reference captures live in `.impeccable/review/ip-sb-reference/`.

Acceptance covers desktop at 1367/1440px; mobile at 390/320px; dark mode; locale and theme persistence; deep-link queries; failed, partial, malformed, and empty responses; stale-result preservation; source selection; visitor-only My IP semantics; live RDAP authority; long-value wrapping; keyboard focus; and minimum mobile targets. The implementation review at `.impeccable/review/ip-sb-build/finish-review.md` records a ship verdict after the sole 44px mobile action finding was fixed. Fifteen browser scenarios and forty Node tests passed for the reviewed build. Existing globe and layout snapshots are historical and do not define acceptance for these rebuilt surfaces.

## Current fidelity status

Continued alignment on 2026-09-12 implements OpenTUI Mono, 56px result headings, 200px desktop labels plus a 16px gap, 58–59px ordinary mobile rows, 44px copy targets, 38/50px search controls, sampled light neutrals, and compact Whois times/contacts. See [design.md](../../design.md#ipsb-alignment-implemented-2026-09-12) and [current checks](../../.impeccable/review/alignment-build/checks.json). Brand, homepage route, bilingual navigation, real source disclosure and no-ad policy remain intentional differences. OpenTUI Mono is the user's chosen variation from IP.SB's Berkeley Mono, not a visual failure to correct.

Header alignment retains only My IP, GeoIP, Whois and GitHub. Desktop gutters are 32px, group gaps 24px and navigation gaps 20px; quick search is 280×36px. At 768px and below the controls stay right-aligned and navigation becomes a single column of 46px links. Escape restores trigger focus; outside click, link selection and desktop resize close the menu. Header search hides at 1000px and below. Body breakpoints and OpenTUI Mono remain unchanged.

Detailed polish aligns GeoIP hero sizing (24px at 390px; 34px desktop), 18px title-to-form spacing, 16px hero input text and desktop hero padding. Result values use #525252 secondary text; body responsive layout now switches at 768px with the header. Row copy remains available on touch, keyboard focus, and during feedback. See [design.md](../../design.md#detailed-alignment-pass-2026-09-12).

The detail pass aligns dark primary action contrast and native disclosure chrome. Copy error placement is scoped to toolbar versus record contexts; interaction and viewport checks are in [.impeccable/review/detail-pass](../../.impeccable/review/detail-pass/report.md).
