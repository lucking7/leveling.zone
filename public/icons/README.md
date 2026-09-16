# Orbit application icons

Raster exports of `src/app/icon.svg`, retaining the accepted Orbit gradient. Regenerate these files when that vector changes.

- `/apple-touch-icon.png`: 180 px, opaque white background, 20 px inset. iOS Home Screen.
- `/favicon.ico`: 16, 32 and 48 px PNG frames. Legacy browser fallback.
- `/icons/favicon-{16,32}.png`: browser raster alternatives.
- `/icons/icon-{192,512}.png`: Web App Manifest icons, opaque white background.
- `/icons/icon-maskable-512.png`: 102 px inset; the mark stays within the central safe circle for launcher masks.
- `/brand/orbit-mark-mono.svg`: Safari pinned-tab mask, with the accent color declared in the document.
- `/icon.svg`: Next.js file-based vector favicon.

`src/app/layout.tsx` declares icon links and the Apple Web App title. `/manifest.webmanifest` declares Orbit's name, start URL, scope, colors and launcher icons. This does not add offline support or guarantee PWA installation on the current HTTP endpoint.

Raster images use square opaque canvases; the OS applies its own Home Screen corner mask. No startup splash images, notification badges or social sharing images are required by the current feature set.
