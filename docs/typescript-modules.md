# TypeScript module inventory

## Repository overview

`leveling.zone` is a Next.js 14 (App Router) web app that aggregates IP-geolocation results from many providers and renders them on a Chinese-language UI. The server side hosts a fan-out of API route handlers under `src/app/api/`: a primary route hits local MMDB/QQWry/IPDB/IP2Location/CSV files (`src/app/api/ip/[ip]/route.ts`, root-level `route.ts`, plus the legacy `src/app/api/query/route.ts`), per-provider routes proxy public IP lookup APIs (`ipbase`, `ipdata`, `ipquery`, `ipregistry`, `ip2location`, `cloudflare`), `src/app/api/myip/route.ts` and `src/app/api/leak/route.ts` collect "where am I" data from ~30 third-party endpoints, and `src/app/api/history/route.ts` persists a JSON file of past lookups. Database files live under `data/db/` or `public/db/` in the repo and (optionally) in Vercel Blob storage; loaders and resolvers in `src/utils/` cope with Vercel's read-only/serverless layout. Reusable typings live in `src/types/`, low-level service classes in `src/lib/` and `src/services/`, and a small standalone helper layer in `src/utils/`. The client surface is a marketing/lookup page (`src/app/page.tsx` and root `page.tsx`) plus a "your IP" page (`src/app/myip/page.tsx`) and a redirect (`src/app/ip/query/page.tsx`); a partial set of shadcn/ui-style primitives (button, input, particles, gradient text, animated grid pattern, etc.) live in `src/components/ui/` alongside many empty placeholder folders that look like aborted scaffolding. Maintenance scripts under `src/scripts/` download, schedule, and upload the geolocation databases. Three root-level files (`route.ts`, `layout.tsx`, `page.tsx`) duplicate `src/app/...` siblings; `page.tsx.new` is a draft variant of `src/app/myip/page.tsx`.

## Counts

- Total TypeScript files tracked in git: **85** (40 `.ts`, 44 `.tsx`, 1 `.tsx.new`)
- Root-level files (`route.ts`, `layout.tsx`, `page.tsx`, `page.tsx.new`): **4**
- `src/app/`: **19** total (6 page/layout files + 13 api route handlers including `src/app/api/myip/route 3.ts`)
- `src/components/`: **36** (`.tsx` — 33 under `src/components/ui/`, 2 top-level, 1 in `theme-provider.tsx/`)
- `src/constants/`: **2**
- `src/lib/`: **3**
- `src/scripts/`: **6**
- `src/services/`: **1**
- `src/types/`: **4**
- `src/utils/`: **10**
- Empty (0-byte) placeholder files: **18** (most `src/components/ui/<name>/index.tsx` files, plus `src/components/theme-provider.tsx/index.tsx`)

## Notable observations

- **Heavy duplication.** Three top-level files (`route.ts`, `layout.tsx`, `page.tsx`) are exact or near-exact duplicates of files under `src/app/...`; `page.tsx.new` is a draft of `src/app/myip/page.tsx`; `src/app/api/myip/route 3.ts` is a second copy of `src/app/api/myip/route.ts`. These look like accidental commits or backup artifacts.
- **Large empty-placeholder surface.** Most files at `src/components/ui/<name>/index.tsx` are 0 bytes (badge, button, dropdown-menu, label, navigation-menu, sheet, sparkles, table, pattern-background, animated-grid-pattern, animated-grid-pattern-demo, animated-shiny-text, animated-text-demo, particles-demo, gradient-demo, "logo 2", `theme-provider.tsx/index.tsx`, `input/index.tsx`). The corresponding flat `*.tsx` siblings (`button.tsx`, `input.tsx`, etc.) are the actual implementations; the subfolders look like an incomplete shadcn/ui add-pass.
- **Weird directory name.** `src/components/theme-provider.tsx/` is a directory whose name *ends with* `.tsx`. It contains an empty `index.tsx`. The intent was probably a `theme-provider.tsx` file.
- **Hard-coded API tokens.** `src/constants/config.ts` ships fallback tokens for `IPINFO_TOKEN` and `IP2LOCATION_TOKEN` — they are committed into the repo and used when the matching env var is unset.
- **Three concurrent IP-database access patterns coexist:** raw `maxmind` package (`route.ts` + `src/app/api/ip/[ip]/route.ts`), `@maxmind/geoip2-node` `Reader` (`src/lib/database.ts`, `src/lib/ip.ts`), and `DatabaseService` singleton (`src/services/database.ts`, used by `src/app/api/query/route.ts`). They duplicate logic.
- **Path-resolution overlap.** `src/utils/dbPath.ts`, `src/utils/file-path.ts`, and `src/utils/db-loader.ts` each implement their own "find the mmdb file across Vercel/local/blob locations" routine, with overlapping but slightly different fallback lists.

## Root-level files

### `layout.tsx`
- Label: Next.js root layout (App Router).
- Exports `metadata` (title/description in Chinese) and a default `RootLayout` component that wraps children in `<html lang="zh">` with `min-h-screen bg-white`. Imports `./globals.css`. Identical to `src/app/layout.tsx`; one of the two is dead.

### `page.tsx`
- Label: Next.js home page (client component).
- Marked `'use client'`; default export `Home` wraps `HomeContent` in `<Suspense>`. `HomeContent` renders the IP-query landing page (Chinese), with a search input, calls `/api/ip/${targetIp}` plus `ipbase`/`ipdata`/`ipquery`/`ipregistry`/`ip2location_io` per-provider routes, merges results, and renders a per-source comparison table with country flags. Uses `next-themes`, `lucide-react`, and components from `@/components/ui/*`. Identical in structure to `src/app/page.tsx`.

### `page.tsx.new`
- Label: Draft variant of the "MyIP" page (not a TS module the build picks up — `.new` extension keeps it out of Next's compile, but git tracks it).
- A modified copy of `src/app/myip/page.tsx`: same `MyIPContent` component reading `/api/myip`, with an extended Chinese/international source-name map and slightly different sort/render logic. Looks like an in-progress edit checked in by accident.

### `route.ts`
- Label: Stray Next.js dynamic route handler at the repo root (probably dead code; Next collects routes only under `src/app/api/`).
- Body is identical to `src/app/api/ip/[ip]/route.ts`: `GET(request, { params: { ip } })` opens the MaxMind/IP2Location/IP2Proxy/QQWry/GeoCN/IPtoASN/ASN-Info databases from `./data/db`, branches on whether the IP looks Chinese (uses GeoCN+QQWry path) or international (DB-IP+IPinfo+IP2Location+DB-IP demo API), aggregates results into `result.sources`, runs `cleanupObject`, and returns a pretty-printed JSON response.

## `src/app/` — pages and layouts

### `src/app/layout.tsx`
- Label: App Router root layout.
- Identical to top-level `layout.tsx`; sets metadata and renders the html/body shell with `globals.css`.

### `src/app/page.tsx`
- Label: App Router home page (client component).
- Identical in shape to top-level `page.tsx` — IP-query landing UI with multi-source result table.

### `src/app/myip/page.tsx`
- Label: "Your IP" page (client component).
- Reads from `/api/myip`, then renders a Chinese/international per-source table mapping internal source keys (`qifu`, `meitu`, `pconline`, `ipip`, `vore`, `toutiao`, `upyun`, `visacn`, `tencentjsonp`, `qqnews`, `zhale`, `zxinc`, `amap`, `meituan`, `cloudflare`, `identme`, `useragentinfo`, `httpbin`, `ipsb`, `ipapis`, `ipapico`, `realip`, `iplark`, `ipquery`, `apipcc`, `ip138`, `ping0`, `leak`, `vercelip`, `apnic`, `discord`, `claude`, `chatgpt`, `surfshark`, `netlify`) to display labels with country emoji.

### `src/app/ip/query/page.tsx`
- Label: Redirect-only client page.
- `'use client'` component that reads the `ip` search-param via `useSearchParams` and calls `router.replace('/?ip=...')` (or `/`) on mount. Returns `null`.

### `src/app/particles/page.tsx`
- Label: Stub demo page for particle animations.
- Returns a heading and a placeholder paragraph in Chinese; no actual particles are rendered.

### `src/app/particles/layout.tsx`
- Label: Layout shell for the particles demo route.
- Wraps children in a `<div className="particles-layout">`.

## `src/app/api/` — route handlers

### `src/app/api/cloudflare/route.ts`
- Label: Next.js API route — Cloudflare network/location info.
- Two helpers (`getCloudflareTrace`, `getCloudflareSpeedMeta`) hit `https://1.1.1.1/cdn-cgi/trace` and `https://speed.cloudflare.com/meta`, validate required fields, then `getCloudflareInfo` merges them into a structured `CloudflareInfo` (location, network, connection, timestamp). `GET` returns full info; rejects if `ip` query param is provided. `dynamic = 'force-dynamic'`.

### `src/app/api/history/route.ts`
- Label: Next.js API route — local history log (file-backed).
- `GET` reads `data/history.json`, supports `ip`, `startDate`, `endDate`, `limit` filters, sorts by timestamp desc. `POST` appends an item with a server timestamp and trims to the most recent 1000 entries. Uses `fs/promises`; will not work on read-only Vercel deployments.

### `src/app/api/ip/[ip]/route.ts`
- Label: Next.js dynamic API route — primary IP lookup (local databases).
- Same body as the top-level `route.ts`. Reads MaxMind GeoLite2 City/Country/ASN, IPtoASN, IPinfo Country-ASN, DB-IP city/country/asn, IP2Location DB11 + PX11 + ASN, QQWry IPDB, GeoCN, and the `asn-info.csv` registry. Branches on whether MaxMind reports country `CN`. Calls out to `https://db-ip.com/demo/home.php` and `https://ipinfo.io/widget/demo/<ip>` for supplemental fields. Cleans nulls via `@/utils/cleanup`.

### `src/app/api/ip/cloudflare/[ip]/route.ts`
- Label: Trivial echo route.
- Just returns `{ ip }` for the given path param. Used as a placeholder so the front end can call `/api/ip/cloudflare/<ip>` without 404; the actual Cloudflare data comes from `src/app/api/cloudflare/route.ts`.

### `src/app/api/ip/ip2location/[ip]/route.ts`
- Label: Provider proxy — IP2Location.io.
- Fetches `https://ip2location.io/${ip}`, scrapes the JSON in the demo `<code class="language-json">` block, and reshapes it into `{ location, network, security, meta }`. Returns 404 on parse failure.

### `src/app/api/ip/ipbase/[ip]/route.ts`
- Label: Provider proxy — ipbase.com.
- Fetches `https://api.ipbase.com/v2/info?ip=<ip>` and forwards the JSON body verbatim.

### `src/app/api/ip/ipdata/[ip]/route.ts`
- Label: Provider proxy — internal `cloudflare.html.zone` aggregator (ipdata).
- Fetches `https://cloudflare.html.zone/api/ip/ipdata?ip=<ip>` and forwards JSON.

### `src/app/api/ip/ipquery/[ip]/route.ts`
- Label: Provider proxy — ipquery.io.
- Fetches `https://api.ipquery.io/<ip>?format=json&_t=<ts>` (with cache-busting timestamp) and forwards JSON.

### `src/app/api/ip/ipregistry/[ip]/route.ts`
- Label: Provider proxy — internal `cloudflare.html.zone` aggregator (ipregistry).
- Fetches `https://cloudflare.html.zone/api/ip/ipregistry?ip=<ip>` and forwards JSON.

### `src/app/api/leak/route.ts`
- Label: Next.js API route — Meituan-based "leak" geolocation.
- `getMeituanLocation(ip)` chains `apimobile.meituan.com/locate/v2/ip/loc` (IP→latlng) and `…/group/v1/city/latlng/<lat,lng>` (latlng→detail) to produce `{ location, accuracy, meta }`. `GET` requires an `ip` query param; `dynamic = 'force-dynamic'`.

### `src/app/api/myip/route.ts`
- Label: Next.js API route — "where am I" multi-source aggregator.
- `runtime = 'edge'`. Reads client IP from headers, then runs `getCloudflareInfo` plus a long sequence of `try { fetchWithTimeout(...) }` blocks against ~25 IP-info APIs (useragentinfo, qjqq, ident.me, ip.sb, ipapi.is, ipapi.co, ip-api.io, zhale, pconline, meitu, ip.cn, iplark, qifu, qqnews, ipip, vore, toutiao, upyun, amap, apipcc, zxinc, ipquery, ip138, leak, ping0, meituan), normalizes each into `{ ip, location, network, [security|meta] }`, and returns a merged `sources` map.

### `src/app/api/myip/route 3.ts`
- Label: Duplicate / older variant of `src/app/api/myip/route.ts` (file name has a literal space + `3`).
- Imports `getClientIP` from `@/utils/ip` and runs a smaller set of seven sources (Cloudflare, ident.me, APIP.CC, zhale, zxinc, amap, ipquery) via `Promise.allSettled`. Probably stale — Next won't pick it up due to the space in the filename.

### `src/app/api/query/route.ts`
- Label: Next.js API route — legacy IP-query endpoint.
- Mixes `@maxmind/geoip2-node` `Reader.openBuffer` (city/country/asn) with raw `maxmind`, `ip2location-nodejs`, `ip2proxy-nodejs`, `lib-qqwry`, plus the `DatabaseService` singleton for `POST` requests. `GET` requires `?ip=`. Compiles a `result` with `maxmind`, `dbip`, `ip2location`, `ipinfo`, `iptoasn`, `geocn`, `qqwry`, `asnInfo`, then strips `'-'` / undefined keys before returning. `POST` accepts `{ ip }` and delegates to `DatabaseService.queryIP`.

## `src/components/`

### `src/components/ClientWrapper.tsx`
- Label: Trivial client-component shell.
- `'use client'` default export wrapping children in a `flex flex-col min-h-screen` div.

### `src/components/Map.tsx`
- Label: react-leaflet map component (client).
- `'use client'`. Renders `MapContainer` with OpenStreetMap tile layer; takes `center`, `zoom`, `children`, plus `fences`/`selectedFence`/`onFenceChange` props (geofences are typed but not actually drawn in this file). Imports `leaflet/dist/leaflet.css`.

### `src/components/theme-provider.tsx/index.tsx`
- Label: Empty placeholder inside an awkwardly named directory (`theme-provider.tsx/`).
- 0 bytes; nothing exported. Likely the result of accidentally creating a directory with the trailing `.tsx` extension instead of a single file.

### `src/components/ui/animated-grid-pattern.tsx`
- Label: Decorative SVG component.
- Generates a grid of randomly-positioned squares, animates their opacity with `framer-motion`, and re-randomizes positions per cycle. Props control width/height/density/opacity/timing.

### `src/components/ui/animated-grid-pattern/index.tsx`
- Label: Empty placeholder; the real implementation lives in the sibling flat file.

### `src/components/ui/animated-grid-pattern-demo.tsx`
- Label: Demo wrapper around `AnimatedGridPattern`.
- Renders a 500px decorative panel with the pattern and a centered heading "Animated Grid Pattern".

### `src/components/ui/animated-grid-pattern-demo/index.tsx`
- Label: Empty placeholder.

### `src/components/ui/animated-shiny-text.tsx`
- Label: Animated headline component.
- `AnimatedText` uses `framer-motion` to animate a left-to-right gradient on a heading. Props: `text`, `gradientColors`, `gradientAnimationDuration`, `hoverEffect`, `className`, `textClassName`. Despite the filename, the export is `AnimatedText` (not "shiny text"), and a `hoverEffect` adds a glow text-shadow.

### `src/components/ui/animated-shiny-text/index.tsx`
- Label: Empty placeholder.

### `src/components/ui/animated-text-demo.tsx`
- Label: Demo wrapper for `AnimatedText`.
- Renders an `<AnimatedText text="Mishra Hub" ...>`; exports `DefaultDemo`. The placeholder text is inherited from a third-party demo source.

### `src/components/ui/animated-text-demo/index.tsx`
- Label: Empty placeholder.

### `src/components/ui/badge/index.tsx`
- Label: Empty placeholder; no implementation in the repo.

### `src/components/ui/button.tsx`
- Label: shadcn/ui-style Button primitive.
- Built on `class-variance-authority` and `@radix-ui/react-slot`. Variants: `default | destructive | outline | secondary | ghost | link`. Sizes: `default | sm | lg | icon`. Forwards refs; supports `asChild`.

### `src/components/ui/button/index.tsx`
- Label: Empty placeholder.

### `src/components/ui/dropdown-menu/index.tsx`
- Label: Empty placeholder.

### `src/components/ui/glowing-search.tsx`
- Label: Animated search-input component (client).
- `'use client'`. `framer-motion` driven input that glows / scales on focus and follows the mouse. Uses internal `Input`/`Button` from `@/components/ui`. Props: `placeholder`, `value`, `onChange`, `onSubmit`, `disabled`, `loading`, `className`. Used by `page.tsx`.

### `src/components/ui/gradient-demo.tsx`
- Label: Two demo wrappers around `GradientText`.
- Exports `GradientTextBorderDemo` (custom colors) and `GradientTextDemo` (animated border) for playground/preview use.

### `src/components/ui/gradient-demo/index.tsx`
- Label: Empty placeholder.

### `src/components/ui/gradient-text.tsx`
- Label: Gradient-animated text component.
- Forwards children with a moving `linear-gradient(to right, ...)` background and optional animated border. Props: `colors`, `animationSpeed`, `showBorder`, `className`, plus standard `HTMLAttributes<HTMLDivElement>`.

### `src/components/ui/gradient-text/index.tsx`
- Label: Alternative client variant of `GradientText`.
- `'use client'` version exporting the same name with simpler API (no `showBorder` border container — just text). Imported from elsewhere; the two `GradientText` exports differ subtly.

### `src/components/ui/input.tsx`
- Label: shadcn/ui-style Input primitive.
- `forwardRef`-wrapped HTML `<input>` with Tailwind utility classes; uses `cn` from `@/lib/utils`.

### `src/components/ui/input/index.tsx`
- Label: Empty placeholder.

### `src/components/ui/interactive-hover-button.tsx`
- Label: Animated hover button.
- A button that swaps its label out for a label + `ArrowRight` icon on hover, with a growing dot animation. Props extend `ButtonHTMLAttributes`; `text` defaults to `"Button"`.

### `src/components/ui/interactive-hover-button-demo.tsx`
- Label: Demo wrapper around `InteractiveHoverButton`.

### `src/components/ui/label/index.tsx`
- Label: Empty placeholder.

### `src/components/ui/logo.tsx`
- Label: Brand logo SVG + wordmark.
- Exports `LevelingLogo` (a circular SVG with stair/level marks rendered inline via Tailwind text-color classes for theming) and `LevelingLogoText` (`LEVELING.ZONE` styled span).

### `src/components/ui/logo/index.tsx`
- Label: Alternate / simpler version of `LevelingLogo` and `LevelingLogoText`.
- `LevelingLogo` here is just a black circle with an `icon-[entypo--code]` glyph. Used by `src/app/myip/page.tsx`. Coexists with the SVG variant in `logo.tsx`.

### `src/components/ui/logo 2/index.tsx`
- Label: Empty placeholder (note literal space in directory name).

### `src/components/ui/navigation-menu/index.tsx`
- Label: Empty placeholder.

### `src/components/ui/particles-demo/index.tsx`
- Label: Empty placeholder.

### `src/components/ui/particles/index.tsx`
- Label: Canvas-based particle background component.
- Exports `Particles({ quantity, staticity, ease, refresh, color, size, className })`. Draws `Point[]` on a canvas, animates them (with mouse-position influence), handles DPR scaling. Used by `page.tsx` and `src/app/myip/page.tsx`.

### `src/components/ui/pattern-background/index.tsx`
- Label: Empty placeholder.

### `src/components/ui/sheet/index.tsx`
- Label: Empty placeholder.

### `src/components/ui/shiny-text.tsx`
- Label: Mouse-tracking shiny text component (client).
- `'use client'`. Layers three gradient-clipped text spans and updates `--mouse-x`/`--mouse-y` CSS vars on `mousemove`. Uses an inline `<style jsx>` block with a `shine` keyframe.

### `src/components/ui/sparkles/index.tsx`
- Label: Empty placeholder.

### `src/components/ui/table/index.tsx`
- Label: Empty placeholder.

## `src/constants/`

### `src/constants/config.ts`
- Label: Build-time configuration constants.
- Detects Vercel via `process.env.VERCEL === '1'` to choose between `public/db` and `data/db` for `DB_DIR`. Exposes `API_TOKENS` (with hard-coded fallback values for `IPINFO_TOKEN` and `IP2LOCATION_TOKEN` when env vars are missing) and `DATABASE_FILES` (filename catalog grouped by provider: MaxMind, IP2Location, DBIP, IPINFO, plus `QQWRY`, `GEOCN`, `IPTOASN`, `AS_INFO`).

### `src/constants/paths.ts`
- Label: Resolved database file paths.
- Builds the `DB_PATHS` object by passing every entry of `DATABASE_FILES` through `getDbPath` from `@/utils/dbPath`. Imported by `src/lib/database.ts` and `src/lib/ip.ts`.

## `src/lib/`

### `src/lib/database.ts`
- Label: `Database` singleton wrapping multiple geo libraries.
- Class with private `MaxMind`/`DBIP`/`IPinfo`/`IP2Location`/`iptoasn` reader fields, lazy `initialize()` (truncated in source — likely loads from `DB_PATHS`), and `query(ip)` returning a normalized `IPQueryResult`. Singleton via `Database.getInstance()`. Re-exports `IPQueryResult` interface.

### `src/lib/ip.ts`
- Label: Procedural IP-info helper.
- Exports `getIpInfo(ip)` which opens MaxMind City/Country/ASN, DB-IP ASN/City/Country, and IPinfo Country-ASN buffers via `Reader.openBuffer` from `@maxmind/geoip2-node`, attaches results to a `result.maxmind` / `result.dbip` / `result.ipinfo` shape, and tolerates per-database read failures.

### `src/lib/utils.ts`
- Label: Small UI utility module.
- Exports `cn(...inputs)` (Tailwind class merger using `clsx` + `tailwind-merge`), `randomInRange(min, max)`, `delay(ms)`, and `formatDate(date)` (formats with `toLocaleDateString('zh-CN', {...})`). Imported broadly by `src/components/ui/*`.

## `src/scripts/`

### `src/scripts/download-geocn.ts`
- Label: Node CLI script.
- Downloads `GeoCN.mmdb` from the `ljxi/GeoCN` GitHub release into `tmp/`, then uploads it via `@vercel/blob`'s `put` to `mmdb/geocn.mmdb`. Requires `BLOB_READ_WRITE_TOKEN`.

### `src/scripts/download-release-db.ts`
- Label: Node CLI script.
- Pulls all required mmdb / .BIN / .csv files from a GitHub release (uses `axios`, `stream/pipeline`), retries up to `MAX_RETRIES`, writes into `tmp/` and then mirrors to Vercel Blob via `BlobStorage`. Hard-codes the file inventory (MaxMind, DB-IP, IP2Location, IPinfo, qqwry, iptoasn, as-info, geocn).

### `src/scripts/local-download-db.ts`
- Label: Node CLI script — local copy of `download-release-db.ts`.
- Same retry/timeout constants but writes only to `data/db/` and `public/db/`; no Blob upload. Hard-codes `lucking7/leveling.zone` as the GitHub source repo.

### `src/scripts/schedule-update.ts`
- Label: `node-cron` daemon.
- Schedules a `0 0 * * *` cron job calling `updateDatabases()` from `update-db`. Intended to be run as a long-lived process.

### `src/scripts/update-db.ts`
- Label: Node CLI script — the master DB updater.
- Reads `IP2LOCATION_TOKEN`/`IPINFO_TOKEN` from env, declares per-provider download configs (IP2Location codes, DB-IP raw URLs, MaxMind, IPinfo), copies into both `data/db` and `public/db`, and (per the `export {}` and rest of file) is callable from `schedule-update.ts`.

### `src/scripts/upload-db-to-blob.ts`
- Label: Node CLI script — Vercel Blob uploader.
- Lists existing blobs under `mmdb/`, walks every file in `DATABASE_FILES`, looks for it in `data/db` then `public/db`, and uploads any that are missing using `@vercel/blob`'s `put` (with `addRandomSuffix: false`). Refuses to run without `BLOB_READ_WRITE_TOKEN`.

## `src/services/`

### `src/services/database.ts`
- Label: `DatabaseService` singleton.
- Private constructor with `getInstance()`; lazily opens MaxMind GeoLite2-City, QQWry (`lib-qqwry`), and `geocn.mmdb` via `getDbPath`. `queryIP(ip)` runs `queryMaxMind`, `queryQQwry`, `queryGeoCN` in series and returns `{ maxmind, qqwry, geoCn }`. Each helper catches and logs errors. Used by `POST` in `src/app/api/query/route.ts` and by some legacy callers.

## `src/types/`

### `src/types/ip.ts`
- Label: Shared TypeScript interfaces for IP data.
- Exports `LocationInfo`, `NetworkInfo`, `IpInfo` (full multi-provider shape including `maxmind`, `dbip`, `ip2location`, `ipinfo`, `iptoasn`, `geocn`, `qqwry`, and a structured `cloudflare` block), and `IPQueryResult`. Imported by `src/lib/database.ts` (for `IPQueryResult`).

### `src/types/ip2location.ts`
- Label: Type definitions for the IP2Location library results.
- `IP2LocationResult`, `IP2LocationProxyResult` (extends with proxy fields), `IP2LocationResponse` (network response shape).

### `src/types/ip2location-nodejs.d.ts`
- Label: Ambient module declaration for `ip2location-nodejs`.
- Declares an `IP2Location` class with `open(dbPath)`, `close()`, and `getAll(ip)` returning the standard fields. Lets TS use the JS package without bundled types.

### `src/types/ipdb.d.ts`
- Label: Ambient module declaration for `ipdb` (QQWry IPDB binary reader).
- Declares an `IPDB` class with `find(ip)` returning `{ code, data: { country_name, region_name, city_name, district_name, isp_domain, owner_domain } }`.

## `src/utils/`

### `src/utils/blob-loader.ts`
- Label: `BlobLoader` singleton fetching mmdb files from Vercel Blob.
- Caches both URLs and Buffers in maps. `getFileFromBlob(fileName)` lists `mmdb/` blobs, finds the file ending with the requested name, fetches it, returns the Buffer.

### `src/utils/blob-storage.ts`
- Label: Higher-level `BlobStorage` singleton wrapping `@vercel/blob` with the `mmdb/` prefix.
- Methods include `uploadDbFile(filename, filePath)` (`put` with `addRandomSuffix: false`), `getDbFile(filename)` (`head` then fetch), and additional helpers (`fileExists`, `listDbFiles`, `del`) implied by callers like `db-loader.ts` and `download-release-db.ts`.

### `src/utils/cleanup.ts`
- Label: Object-cleanup helper.
- `cleanupObject(obj)` walks the object recursively, removing keys whose value is `undefined`, `null`, or the string `'-'`, and prunes empty sub-objects. Used by the IP-query routes to strip placeholders before responding.

### `src/utils/country.ts`
- Label: Country flag emoji helper.
- `countryToFlag(countryCode)` converts an ISO-3166 code to its emoji using regional indicator code points; falls back to `🌐`.

### `src/utils/db-loader.ts`
- Label: `DbLoader` singleton — Blob-or-FS loader with caching.
- Tries Vercel Blob first via `BlobStorage`, falls back to local FS via `findDbFilePath`, caches Buffers by filename. Provides `loadDbFile`, `dbFileExists`, `getDbFileSize`, `listAvailableDbFiles`. Spews verbose debug logs in dev/`DEBUG`.

### `src/utils/dbPath.ts`
- Label: Synchronous DB-path resolver.
- `getDbPath(filename)` checks `cwd()/data/db`, `cwd()/public/db`, `/var/task/public/db`, and `cwd()/.vercel/output/static/db` for the file via `fs.existsSync`. Returns the first hit, otherwise `cwd()/public/db/<filename>` with a warning.

### `src/utils/file-path.ts`
- Label: A more elaborate path resolver than `dbPath.ts`.
- Considers `MMDB_PATH` env var, Vercel Lambda paths, `/tmp/db`, etc. Exports `findDbFilePath(filename)`, `getDbFileCdnUrl(filename)` (returns `/_next/static/db/<filename>` or a `https://${VERCEL_URL}/...` URL), and `getDbDirPath()` for the directory.

### `src/utils/ip.ts`
- Label: Shared IP utilities used by API routes.
- Exports `isValidIpAddress`, `handleLocalhost` (rewrites loopback to `8.8.8.8`), `cleanupObject`, `getCountryFlag` (small static lookup table — note: differs from `country.ts`), `getClientIP(request)` (reads `x-forwarded-for`/`x-real-ip` and falls through to `8.8.8.8`), `formatAsn`, `normalizeCoordinates`.

### `src/utils/ipSources.ts`
- Label: Collection of per-source fetch helpers.
- Imports `formatASN` from `./network`. Defines `fetchWithTimeout` plus a long list of `getCloudflareInfo`, `getUserAgentInfo`, `getQjqq`, etc. Each helper hits one third-party IP-info API and normalizes the response into `{ ip, location, network, [meta] }`. (~800 lines.) Centralizes the logic that `src/app/api/myip/route.ts` inlines.

### `src/utils/network.ts`
- Label: Tiny ASN/network formatter helpers.
- `formatASN(asn, organization, name)` produces strings like `AS13335 | Cloudflare | Cloudflare, Inc.`; `formatNetworkInfo({asn, organization, name, route, domain, type})` returns a normalized object.
