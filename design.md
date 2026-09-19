---
name: "ORBIT / 地址观测"
description: "A narrow, quiet IP lookup workspace shaped by the clarity of IP.SB."
colors:
  canvas: "#ffffff"
  text: "#000000"
  secondary: "#525252"
  secondary-dark: "#b9b9b9"
  muted: "#737373"
  surface: "#fafafa"
  line: "#e5e5e5"
  accent: "#267436"
  error: "#a62828"
  error-surface: "#fff5f5"
  focus: "#315cc5"
  selection: "#000000"
  button-fill: "#fafafa"
  button-text: "#000000"
  button-fill-dark: "#ffffff"
  button-text-dark: "#171717"
  canvas-dark: "#151515"
  text-dark: "#ededed"
  muted-dark: "#aaaaaa"
  surface-dark: "#202020"
  line-dark: "#363636"
  accent-dark: "#85c990"
  error-dark: "#ffa4a4"
  error-surface-dark: "#2b1b1b"
  focus-dark: "#94b3ff"
typography:
  display:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.3
  headline:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
  action:
    fontFamily: "OpenTUI Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
  input:
    fontFamily: "OpenTUI Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "OpenTUI Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  technical-value:
    fontFamily: "OpenTUI Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "18px"
  geoip-value:
    fontFamily: "OpenTUI Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "18px"
rounded:
  compact: "6px"
  control: "8px"
  notice: "10px"
  panel: "12px"
  header-search: "24px"
  action: "28px"
  search: "30px"
spacing:
  xs: "8px"
  sm: "10px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
  page: "32px"
  header: "32px"
  section: "44px"
  footer: "72px"
components:
  button-primary:
    backgroundColor: "{colors.button-fill}"
    textColor: "{colors.button-text}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    padding: "0px 16px"
    height: "38px"
  button-primary-mobile:
    backgroundColor: "{colors.button-fill}"
    textColor: "{colors.button-text}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    padding: "0px 18px"
    height: "50px"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "36px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.input}"
    rounded: "{rounded.search}"
    padding: "0px 16px"
    height: "38px"
  panel:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
  record-row:
    typography: "{typography.body}"
    padding: "6px 24px"
    height: "48px"
  record-row-mobile:
    typography: "{typography.body}"
    padding: "10px 24px"
    height: "58px"
---

# Design System: ORBIT / 地址观测

## Overview

**Creative North Star: "The Quiet Network Utility"**

ORBIT is a focused IP lookup workspace. Its visual hierarchy follows the useful restraint of IP.SB: a white default canvas, a narrow centered reading column, plain bordered records, compact controls, and technical values that remain easy to scan. The interface should feel quick and trustworthy before it feels branded.

The identity comes from Space Grotesk, the gradient ORBIT mark and Geist wordmark, disciplined spacing, and accurate source labels. Light and dark themes share the same geometry. The retired ASCII globe, serif headlines, dark science-fiction staging, advertisements, sample shortcuts, and fictional recent history are outside this system.

**Key Characteristics:**

- A full-width header with a 56px minimum above a 920px maximum content shell.
- White or near-black canvases with one-pixel dividers and no shadows.
- Pill-shaped search controls inside softly rounded, table-like result panels.
- One selected real source drives the readable summary; additional sources and raw data remain available.
- OpenTUI Mono is self-hosted for inputs, search actions, IP panel titles, technical record values, and raw JSON. Space Grotesk remains the surrounding interface face.

### Reference and font choice

The visual reference is IP.SB, with intentional differences: ORBIT branding, bilingual controls, real multi-source selection, no advertisements, and no fictional data. The root page is a GeoIP search; visitor data remains at `/myip`.

The user selected OpenTUI Mono instead of the reference site's Berkeley Mono. Font files, SIL OFL license and source hashes are maintained in [public/fonts/opentui-mono](public/fonts/opentui-mono/SOURCE.md). Chinese uses the platform fallback. Current geometry and interaction requirements are defined below; historical local captures are not acceptance evidence for later builds.

## Colors

The palette is deliberately quiet: neutral surfaces do most of the work, red communicates failure, and blue is reserved for keyboard focus. Green is declared for badge selectors; the captured source names and registry links render in neutral colors.

### Primary

- **Registry Green** (`#267436`, dark `#85c990`): available to badge styling. Do not describe all current source or registry labels as green; the live lookup surfaces predominantly use neutral labels.

### Secondary

- **Failure Red** (`#a62828`, dark `#ffa4a4`): actionable errors, paired with the matching error surface.
- **Focus Blue** (`#315cc5`, dark `#94b3ff`): the global two-pixel `:focus-visible` outline.

### Neutral

- **Paper Canvas** (`#ffffff`, dark `#151515`): page and panel background.
- **Ink** (`#000000`, dark `#ededed`): primary text and active navigation.
- **Utility Gray** (`#737373`, dark `#aaaaaa`): descriptions, labels, inactive navigation, and secondary actions.
- **Soft Fill** (`#fafafa`, dark `#202020`): search fields, buttons, code blocks, and hover feedback.
- **Hairline** (`#e5e5e5`, dark `#363636`): header, panel, row, disclosure, and control borders.

### Named Rules

**The Structural Color Rule.** Use color to communicate source, focus, or failure. Keep the rest of the hierarchy neutral.

## Typography

**Display Font:** Space Grotesk (self-hosted variable font, 300–700, with platform sans-serif fallbacks)  
**Body Font:** Space Grotesk (same fallback stack)  
**Mono Font:** OpenTUI Mono (self-hosted Regular/Bold/Italic/BoldItalic), then `ui-monospace`, `SFMono-Regular`, Menlo, Consolas, monospace

**Character:** Space Grotesk keeps the interface compact and contemporary without turning the lookup tool into a developer console. Monospace appears only where character shape and alignment matter.

### Hierarchy

- **Display** (600, clamp(24px, 4vw, 34px), normal): centered empty-state GeoIP title; 24px at 390px.
- **Headline** (600, 24px, 1.3): Whois and standard page titles.
- **Title** (600, 18px, 1.3): result panel headings and mobile panel headings.
- **Body** (400, 14px, 1.5): descriptions, values, notices, and controls.
- **Label** (600, 13px, 1.5): compact header search and navigation emphasis.
- **Action** (400, 12.5px desktop / 14px mobile, 1.5): OpenTUI Mono search buttons.
- **Input** (400, 14px, 1.5): desktop IPv4/IPv6 entry; 16px on mobile.
- **Mono** (400, 13px, 1.6): raw JSON, with 12px mobile code. Technical GeoIP/My IP record values use 15px and Whois values use 14px, both with 18px row line height. IP headings use 18px. Primary inputs use 14px desktop / 16px mobile.

### Named Rules

**The Technical Text Rule.** Use OpenTUI Mono for inputs, search actions, IP headings, raw JSON and explicitly marked IP, ASN, range, coordinate, time, handle, email and phone values. Keep ordinary names, locations, labels and explanations in Space Grotesk.

## Layout

The site header spans the viewport and stays at least 56px tall. Desktop header padding is 32px, with a 24px group gap and 20px navigation gap. Header quick search is 280×36px and hides at 1000px and below. The main and footer share a 920px maximum width; the main uses 32px side padding, leaving a 856px content measure, with 44px top and 72px bottom padding.

The GeoIP empty state centers a responsive 24–34px heading over a lookup form capped at 560px. Result pages use the full content width. Panel headings have a 56px minimum with zero vertical padding around their actions; long wrapping titles may grow. Desktop record rows use a 200px label column, a 16px gap, a flexible value column and a 48px minimum height. At 768px and below, page gutters become 20px and rows stack label above value, with a 58px minimum and 18px line height. Copy actions are positioned within the row instead of determining its height; their 44px targets remain visible on mobile. Primary mobile form controls are 50px. Navigation, source, copy, retry and secondary controls remain at least 44px. At 768px and below, the header uses 16px gutters and 44px action targets. Its mobile navigation opens as a full-width single column with 46px links and hairline dividers.

Spacing follows the observed 8, 10, 12, 16, 20, 24, and 32px rhythm. Long addresses, registration text, and JSON wrap or scroll within their own container and must never widen the page.

## Elevation & Depth

The system uses no shadows. One-pixel borders, neutral fills, whitespace, and disclosure state establish depth. Panels stay on the page canvas, while inputs and code blocks use the soft fill.

### Named Rules

**The Flat Utility Rule.** Do not add drop shadows, glows, glass effects, or floating cards. Use the hairline and spacing to separate structure.

## Shapes

Data panels and source disclosures use 12px corners, notices and code blocks use 10px, compact secondary controls use 8px, and search fields use 24–30px pill corners. Borders are one pixel. The roundness belongs to interactive controls and bounded records; it does not turn every text group into a card.

## Components

### Buttons

- **Primary:** neutral soft-fill pill, OpenTUI Mono 400, `0px 16px`, 38px height. The large empty-state form uses 52px on desktop and mobile forms use 50px.
- **Hover / Focus:** hover shifts from surface to hairline; focus uses the two-pixel blue outline with a three-pixel offset. Color transitions run for 150ms only when reduced motion is not requested.
- **Secondary:** canvas background, one-pixel hairline border, 8px corners, and `8px 12px` padding. Mobile height is at least 44px.

### Inputs / Fields

- **Style:** soft-fill background, one-pixel hairline, 30px radius, OpenTUI Mono text, 38px desktop height and `0px 16px` padding; mobile uses 50px and `0px 18px`.
- **Focus:** the global focus outline remains visible; header quick search uses a focus-within outline around the container.
- **Error / Disabled:** errors appear in a separate red notice. Disabled buttons retain their shape and reduce opacity to 0.55.

### Cards / Containers

- **Corner Style:** 12px for data panels and source disclosures.
- **Background:** canvas for panels, soft fill for raw JSON.
- **Shadow Strategy:** none.
- **Border:** one-pixel hairline around the container and between rows.
- **Internal Padding:** panel headings and desktop rows use 24px horizontal padding; raw JSON uses 20px, or 14px on mobile.

### Navigation

The header combines the orange diagonal ORBIT mark with a title-case sans-serif Orbit wordmark, My IP, GeoIP, Whois, Egress, GitHub, quick search, language, and theme controls. Default links use muted text; the active route uses primary text. Desktop links occupy the 56px header height. At 768px and below, navigation is hidden behind a 44px menu control and opens as a single column below the first row. Language, theme and menu stay right-aligned. Escape closes the menu and restores focus to its trigger; clicking outside, selecting a link or resizing to desktop also closes it. These five links represent implemented routes; do not add unimplemented reference sections.

### Egress diagnostics

The `/egress` surface follows the existing narrow lookup layout and shared header. Its primary task is to compare the IP addresses observed by different websites. A single explicit start/retry action initiates browser-side probes; entering the page does not automatically fan out requests. Valid results appear in a stable source order, with source name, actual IP, address family, network and estimated location. IP links lead to the existing GeoIP route, and copy controls copy that row's address.

Desktop uses a semantic named table. At 768px and below, rows reflow into readable labelled records without horizontal page scrolling. Reuse the existing canvas, line, muted text, OpenTUI Mono technical values, country flags and 44px touch targets. Do not use national flags to invent the origin of a provider; location flags require returned country codes.

Loading communicates progress without one skeleton/card per failed service. Failed, invalid and unconfigured probes are omitted; an entirely empty run offers retry. Starting a new run clears previous addresses so old results cannot masquerade as current measurements. Switching language or theme retains current data without probing again. Leaving the page cancels outstanding work. Results never claim AI-service unlock or substitute a deployment-host address.

### Source Selector

Sources use the existing labelled native select when more than one usable source exists; a single source is a static label. Results always identify the selected real source. All sources remain in a separate disclosure with a named comparison table, followed by an independent Raw JSON disclosure with a named, keyboard-scrollable code region. Adding providers must not expand the initial summary into a wall of cards.

### Data Record

`DataPanel` and `DataRow` form the signature result surface. The panel heading holds the result title and compact actions. Each definition-list row separates a muted label from a wrapping value; copy actions become persistently visible on mobile. Missing provider fields are omitted instead of replaced with invented facts.

### Status and Disclosure

Notices use a 10px radius and `14px 18px` padding. Error notices pair failure red with the error surface. Full source data and Raw RDAP JSON remain in native `details` disclosures with a 56px summary target and bounded code area.

## Do's and Don'ts

### Do:

- **Do** keep the 920px shell, 32px desktop padding, 20px mobile gutters, and one-pixel record structure.
- **Do** use the light theme as the default and preserve the same token roles in dark mode.
- **Do** label selected GeoIP sources and authoritative RDAP registries accurately.
- **Do** keep every mobile action at least 44px and primary mobile form controls at 50px.
- **Do** preserve whitespace and progressive disclosure when technical responses are long.

### Don't:

- **Don't** restore the ASCII globe, serif display typography, orbital motion, or the retired dark cinematic layout.
- **Don't** add ads, example-address shortcuts, fictional recent queries, or third-party brand imitation.
- **Don't** invent PTR, registered-country, location, topology, or port-43 Whois fields.
- **Don't** hide source identity, failure state, or the estimated nature of GeoIP data.
- **Don't** introduce shadows, gradients, glass effects, or decorative color that competes with the data.

### Compact results and responsive controls

The GeoIP hero uses a responsive 24–34px title with normal font line height and an 18px gap before search. At 390px the English title stays on one line, starts at y=109px and the search starts at approximately y=157.5px. Desktop hero inputs use 16px OpenTUI Mono, 22px horizontal padding and 52px height; its button uses 14px and 26px horizontal padding. At 768px and below these controls use 50px height and 18px padding, while record rows and page gutters switch together to their mobile layout. At 320px, titles wrap naturally.

Record values use secondary text (#525252 light, #b9b9b9 dark), keeping titles black/primary and labels muted. Compact copy controls outside record rows remain visible; row controls appear on hover or focus-within, remain visible during success/failure feedback, and always show on touch devices. On mobile, IPv6 headings take a full-width line and actions follow below, preserving the address measure; IPv4 retains the compact single-row header. Copy failure feedback sits beside its trigger, inside the panel bounds.

ORBIT branding, OpenTUI Mono, bilingual controls, complete source data and visible mobile copy targets remain intentional differences from the reference. Do not add advertisements, examples or recent-query history.

### Disclosure and dark actions

Primary query buttons use dedicated button tokens: #fafafa / #000 in light mode, #fff / #171717 in dark mode, and #f0f0f0 / #dedede hover fills. Text selection reverses canvas and text colors. Source and RDAP disclosures use a 56px native summary with a right chevron, an open-state divider, inset keyboard focus and a 200ms rotation only when reduced motion is not requested.

Compact copy failures in rows and panel headings remain beside the trigger, within the panel. Toolbar copy failures anchor below the full action row, preventing either edge from clipping at 320px.


### Logo and wordmark

The user selected the ilanla logo shown in [Chatto / Beew Studio’s post](https://x.com/itschatto/status/2081380623323738266). Its rounded diagonal silhouette, two inset tail cuts and circular counter are reconstructed as SVG. Use the orange gradient mark (#ffb44d → #ef7b35 → #9d4629, upper right to lower left) at 30px beside a 27px Geist Sans Bold Orbit wordmark. Preserve the existing interface and OpenTUI Mono data typography. The icon alone serves the favicon. The wordmark is an ORBIT adaptation; the source post does not specify that typography. See [logo assets and provenance](docs/design/orbit-logo.md).


### Result actions and technical labels

Retain the 920px outer shell, 56px panel headings, 48px desktop rows and stacked mobile rows. GeoIP displays a muted IPv4/IPv6 badge beside Whois, without repeating a version row. Whois uses an IP Geolocation link and green RDAP badge. Plain text field values offer copy actions, with 44px mobile targets and existing error feedback. Data reflects the selected source; registered country must not be substituted with geolocation country. No reference advertisements or unsupported ASN/domain navigation are added.

Brand typography is configured independently through `--font-brand`, `--brand-size`, `--brand-weight`, and `--brand-tracking` in `src/app/globals.css`. Current values are Geist Sans, 27px, 700 and -1px. The OpenTUI Mono data font is unchanged.


Orbit uses locally hosted Geist Sans Bold from Vercel’s public font repository, at 27px / 700 / -1px tracking. This is the public font family, not a claim that the standalone Vercel SVG logotype is an unmodified font. Font provenance and license: `public/fonts/geist/SOURCE.md` and `OFL.txt`.


Header navigation uses the existing Lucide SVG family for My IP, GeoIP, Whois, Egress and GitHub. Use 16px icons, 2px rounded strokes and a 7px text gap in both desktop and mobile navigation. Icons inherit the active/muted link color and are decorative (`aria-hidden`); the visible labels retain accessible names.

Language switch: icon-only Lucide Languages at 18px / 2px stroke, matching the theme control. A right-aligned 176px menu offers 简体中文 and English with a current-language check. Desktop trigger is 36px and mobile targets are 44px.

Country flags follow the IP.SB GeoIP reference: 20×15 SVG (4:3), before the Location value with a 7px gap. GeoIP/My IP use the selected source’s country code; Whois uses the registration country on its Country row. Do not infer codes from country names or combine registration and geolocation. Invalid/missing codes omit the image. Assets from flag-icons are locally hosted with MIT attribution; text and copy values remain available independently of the decorative image.


### Source controls and disclosure

GeoIP and My IP use shared `SourcePicker` and `SourceData`. The active source is selected above the result panels using a labeled native select; selecting a source only changes the current view and does not fetch again. One source appears as static text. The existing copy action retains the complete response.

“All sources / 所有来源” shows the usable source count and a comparison of source, network, and location. A check identifies the current selection. It does not expose JSON. Desktop uses aligned table columns; mobile uses stacked source rows with network/location labels. “Raw JSON / 原始 JSON” is a separate disclosure, closed initially. Empty source results remain excluded. Country flags preserve selected-source semantics.

Language menu uses menu/menuitemradio semantics, focuses the current language on opening, supports arrows/Home/End, closes with Escape or outside interaction, and restores trigger focus after selection or Escape. Tab exits normally. Language and mobile navigation menus are mutually exclusive. Locale updates preserve the current IP, selected source and disclosures; there is no reload or query refetch. A 120ms opacity/translation entrance respects reduced motion.
