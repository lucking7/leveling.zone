# IP.SB reference redesign

The user selected IP.SB GeoIP and Whois as the visual references. Preserve ORBIT branding and product behavior; the prior ASCII globe and serif layout are retired. [design.md](../../design.md) owns the current visual tokens, dimensions and interaction details.

## Surface mode

**Operate.** The visitor's primary job on GeoIP, My IP, and Whois is to enter or inspect an address, read a source-labelled result, copy useful values, compare sources, and recover from errors. Scanability, accurate provenance, direct controls, and stable record geometry outrank decorative expression. This mode applies to these lookup surfaces, not to the product as a whole.

## Visual contract

Use a white/light default with optional dark mode. The 56px full-width header has a thin bottom border, ORBIT wordmark, My IP, GeoIP, Whois, and Egress navigation, GitHub link, quick search, language action, theme action, and mobile menu. The content container is 920px including 32px desktop side padding, yielding 856px panels. At mobile widths, use 20px gutters and disclose the navigation beneath the header row.

Space Grotesk is a self-hosted variable font under the SIL OFL. The user-selected OpenTUI Mono is self-hosted for inputs, search actions, IP titles, technical values and JSON. Ordinary interface text remains Space Grotesk. Do not use unlicensed Berkeley Mono or the retired serif display font.

The GeoIP empty viewport centers a 34px title above a 560px maximum pill search with 52px controls and a muted explanation. A result uses the compact full-width search, explicit selected-source provenance, an address/location panel, and a network panel. Whois uses a 24px title, the same search pattern, structured network range, CIDR, handle, name, type, country, parent, event, contact, registry, endpoint, notice, link, and Raw RDAP JSON fields when present. Panels use 12px corners, one-pixel `#e5e5e5` light-theme borders, and no shadows. Desktop rows use 200px labels and a 16px gap; mobile rows stack labels above values.

Existing multi-source GeoIP and My IP data remains available. One actual source drives the visible summary so the interface never merges values into a fictional combined record. Additional sources appear in a selector and a comparison disclosure. Complete JSON has its own disclosure. A source with only risk data is still a valid result even when location and network are unavailable.

## Product constraints

Retain the ORBIT brand, bilingual state, light/dark persistence, actual local database queries, optional public-IP external queries, visitor-only My IP semantics, copy and retry actions, complete JSON, silent omission of empty sources, and explicit stale-result labels. Do not reproduce reference ads, third-party branding or copyright, example addresses, global recent history, PTR fields, or registered-country facts that the product does not have. Only render functional navigation links. The prior globe is not rendered on these pages.

Whois uses real RDAP registration data. IANA bootstrap selects among the authoritative AFRINIC, APNIC, ARIN, RIPE NCC, and LACNIC endpoints. Requests support IPv4 and IPv6 literals only; domain and ASN search are not claimed. Use HTTPS allowlisting, at most three same-address RIR redirects, a five-second upstream timeout, a twelve-second total server deadline, a 2 MiB response cap, and returned-network range validation. The browser applies a fifteen-second timeout. Label raw output as RDAP JSON and surface not-found, rate-limit, timeout, malformed, and upstream failures honestly.

`/myip` shows only the address the current connection exposes to the trusted entry layer, queries local databases with external providers disabled, and requires every result row to match that address with `request-ip` scope. It must never substitute a server-egress address. Public GeoIP external mode may send the entered public IP to configured third parties; non-public targets remain local.

Do not claim deployment status from local implementation or tests. Host, Docker, database snapshot, and target-server status require their own runtime evidence. Keep databases and credentials outside public static paths and Git history.

## Acceptance

Verify the current production build at desktop widths and 390/320px mobile widths. Cover dark mode; locale/theme persistence; deep links and browser history; failed, partial, malformed and empty responses; preservation of previous successful results; security-only results; source selection; visitor-only My IP provenance; RDAP failures; long-value wrapping; keyboard focus; and minimum mobile targets.

Run the repository Node tests and the browser regressions against the build being evaluated. Historical local screenshots and prior passing counts do not establish current acceptance. Browser fixtures prove controlled rendering and interaction; real upstream behavior and target deployment require separate checks.

OpenTUI Mono is the user's intentional choice. The root remains GeoIP search, `/myip` remains visitor-only, and the interface retains bilingual navigation, complete real data, no advertisements and no invented history. Detailed geometry and controls are maintained once in [design.md](../../design.md).
