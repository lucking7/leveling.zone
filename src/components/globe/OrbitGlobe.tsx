"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "../locale";
import land from "./land.json";

export type GlobeTarget = {
  latitude: number;
  longitude: number;
  label: string;
};
const rad = Math.PI / 180;
const wrap = (n: number) => ((n + 540) % 360) - 180;

const point = (latitude: number, longitude: number) => {
  const lat = latitude * rad, lon = longitude * rad;
  return { x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon) };
};
const landPoints = land.map(([lat, lon], i) => ({ ...point(lat, lon), glyph: ["+", ":", "·", "*"][i % 4] }));
const gridPoints = (() => {
  const points = [];
  for (let lat = -75; lat <= 75; lat += 15)
    for (let lon = -180; lon < 180; lon += 5) points.push(point(lat, lon));
  for (let lon = -180; lon < 180; lon += 30)
    for (let lat = -87; lat <= 87; lat += 3) points.push(point(lat, lon));
  return points;
})();

export function OrbitGlobe({
  target,
  caption,
  idleSpin = false,
}: {
  target?: GlobeTarget;
  caption: string;
  idleSpin?: boolean;
}) {
  const { t } = useLocale();
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef({ latitude: 15, longitude: -35 });
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    let frame = 0,
      last = 0,
      visible = true;
    let width = 1,
      height = 1;
    const destination =
      target &&
      Number.isFinite(target.latitude) &&
      Math.abs(target.latitude) <= 90 &&
      Number.isFinite(target.longitude) &&
      Math.abs(target.longitude) <= 180
        ? target
        : undefined;
    const start = { ...view.current };
    const longitudeDelta = destination ? wrap(destination.longitude - start.longitude) : 0;
    const latitudeDelta = destination ? destination.latitude - start.latitude : 0;
    const distance = Math.hypot(latitudeDelta, longitudeDelta);
    const duration = 0.55 + 0.65 * Math.min(distance / 180, 1);
    let elapsed = 0;
    const targetPoint = destination ? point(destination.latitude, destination.longitude) : undefined;
    const draw = (time: number) => {
      frame = 0;
      if (document.hidden || !visible) {
        last = 0;
        return;
      }
      const dt = Math.min((time - (last || time)) / 1000, 0.1);
      last = time;
      const v = view.current;
      elapsed += dt;
      const progress = Math.min(elapsed / duration, 1);
      // Quintic easing has zero velocity and acceleration at both ends.
      const eased = progress ** 3 * (10 + progress * (-15 + 6 * progress));
      if (destination) {
        v.latitude = start.latitude + latitudeDelta * eased;
        v.longitude = wrap(start.longitude + longitudeDelta * eased);
        if (progress === 1) {
          v.latitude = destination.latitude;
          v.longitude = destination.longitude;
        }
      }
      if (!destination && idleSpin) {
        v.longitude = wrap(v.longitude + dt * 3);
      }
      const radius = Math.min(width, height) * 0.46,
        cx = width / 2,
        cy = height / 2;
      const lat0 = v.latitude * rad, lon0 = v.longitude * rad;
      const sinLat = Math.sin(lat0), cosLat = Math.cos(lat0);
      const sinLon = Math.sin(lon0), cosLon = Math.cos(lon0);
      const project = (p: ReturnType<typeof point>) => {
        const depth = p.x * sinLon + p.z * cosLon;
        return {
          x: cx + radius * (p.x * cosLon - p.z * sinLon),
          y: cy - radius * (cosLat * p.y - sinLat * depth),
          z: sinLat * p.y + cosLat * depth,
        };
      };
      ctx.clearRect(0, 0, width, height);
      // The far orbit sits behind the globe; the near half crosses its surface.
      const orbit = (from: number, to: number, alpha: number) => {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#e58c63";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 7]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius * 1.08, radius * 0.32, -0.3, from, to);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      };
      orbit(Math.PI, Math.PI * 2, 0.25);
      ctx.fillStyle = "#0f1410";
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#39433b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      // Match glyph width to the three-degree geographic sampling interval.
      // Small canvases retain coastlines without overlapping seven-pixel text.
      ctx.font = `${Math.min(10, Math.max(4, radius * 0.055))}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#39433b";
      for (const point of gridPoints) {
        const p = project(point);
        if (p.z <= 0) continue;
        ctx.globalAlpha = Math.min(p.z / 0.15, 1);
        ctx.fillRect(p.x, p.y, 0.75, 0.75);
      }
      ctx.fillStyle = "#c5dcab";
      for (const point of landPoints) {
        const p = project(point);
        if (p.z <= 0) continue;
        ctx.globalAlpha = Math.min(p.z / 0.15, 1) * (0.35 + p.z * 0.65);
        ctx.fillText(point.glyph, p.x, p.y);
      }
      ctx.globalAlpha = 1;
      orbit(0, Math.PI, 0.7);
      ctx.strokeStyle = "#e58c63";
      if (targetPoint) {
        const p = project(targetPoint);
        if (p.z > 0) {
          ctx.globalAlpha = Math.min(p.z / 0.15, 1) * (0.25 + 0.75 * eased);
          ctx.fillStyle = "#e58c63";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x, p.y, 10 + 6 * (1 - eased), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      element.dataset.motion = destination ? (progress < 1 ? "locating" : "settled") : idleSpin ? "idle" : "still";
      element.dataset.longitude = v.longitude.toFixed(3);
      element.dataset.latitude = v.latitude.toFixed(3);
      const moving = Boolean(destination) && progress < 1;
      if (moving || (!destination && idleSpin)) frame = requestAnimationFrame(draw);
    };
    const wake = () => {
      cancelAnimationFrame(frame);
      last = 0;
      frame = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(() => {
      const bounds = element.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      wake();
    });
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      wake();
    });
    observer.observe(element);
    intersection.observe(element);
    document.addEventListener("visibilitychange", wake);
    wake();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", wake);
    };
  }, [target?.latitude, target?.longitude, idleSpin]);
  return (
    <div className="orbit-globe">
      <canvas
        ref={canvas}
        role="img"
        aria-label={
          target
            ? t(
                `地球定位：${target.label}，纬度 ${target.latitude}，经度 ${target.longitude}，数据源估计位置`,
                `Globe location: ${target.label}, latitude ${target.latitude}, longitude ${target.longitude}. Estimated by source.`,
              )
            : t("ASCII 地球地理视图", "ASCII globe geographic view")
        }
      />
      <div className="globe-controls">
        <p role="status">{caption}</p>
      </div>
    </div>
  );
}
