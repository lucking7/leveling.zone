# ORBIT logo

Reference selected by the user: https://x.com/itschatto/status/2081380623323738266 (Chatto, ilanla logo design & branding, Beew Studio). The public post contains a 4.52-second animation showing outline, black and orange-gradient versions.

This is a manually reconstructed SVG based on the selected reference, not the author’s original vector file. The Orbit wordmark uses Geist Sans Bold; the source does not identify a wordmark font. No external font dependency is introduced.

- Header: `src/components/orbit-logo.tsx`, 30px orange-gradient mark and 27px Geist Sans Bold text. Its gradient ID is generated per component instance to avoid collisions.
- Color asset: `public/brand/orbit-mark.svg`.
- Monochrome asset: `public/brand/orbit-mark-mono.svg`.
- Favicon: `src/app/icon.svg`, same geometry.
- Maintain transparent counters, round ends and diagonal orientation. The color version runs from light golden orange at the upper right through orange to deep brown orange at the lower left. Gradients use `gradientUnits="userSpaceOnUse"` so direction stays tied to the mark geometry. No continuous header animation.

The reference is credited to its designer; these files do not establish original authorship or a license from that designer.


2026-09-13 typography update: Orbit uses locally hosted Geist Sans Bold from Vercel’s public font repository, at 27px / 700 / -1px tracking. This is the public font family, not a claim that the standalone Vercel SVG logotype is an unmodified font. Font provenance and license: `public/fonts/geist/SOURCE.md` and `OFL.txt`.
