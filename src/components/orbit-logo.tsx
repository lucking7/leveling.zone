import { useId } from "react";

/** Vector reconstruction of the user-selected ilanla reference; see docs/design/orbit-logo.md. */
export function OrbitLogo() {
  const gradientId = `orbit-gradient-${useId().replace(/:/g, "")}`;

  return <><svg className="orbit-mark" width="30" height="30" viewBox="0 0 84 84" fill="none" aria-hidden="true" focusable="false"><defs><linearGradient id={gradientId} x1="68" y1="14" x2="16" y2="72" gradientUnits="userSpaceOnUse"><stop stopColor="#ffb44d" /><stop offset="0.48" stopColor="#ef7b35" /><stop offset="1" stopColor="#9d4629" /></linearGradient></defs><path fill={`url(#${gradientId})`} fillRule="evenodd" d="M8 45 36 17C45 8 59 8 68 17S77 40 68 49L43 74A5 5 0 0 1 36 67L43 60A5 5 0 0 0 36 53L33 56A5 5 0 0 1 26 49L35 40A5 5 0 0 0 28 33L15 46A5 5 0 0 1 8 45Z M57 43a5 5 0 1 0 0 10a5 5 0 1 0 0-10Z M23 60a5 5 0 1 0 0 10a5 5 0 1 0 0-10Z" /></svg><span className="orbit-wordmark">Orbit</span></>;
}
