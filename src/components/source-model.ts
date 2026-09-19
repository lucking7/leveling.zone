import type { SourceResult } from "@/modules/query/types";
import type { Translate } from "./locale";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isSourceResult(value: unknown): value is SourceResult {
  return isRecord(value) && typeof value.label === "string" &&
    isRecord(value.location) && isRecord(value.network) &&
    Object.values(value.network).every(item => item == null || typeof item === "string") &&
    Object.entries(value.location).every(([key, item]) => item == null ||
      (["latitude", "longitude"].includes(key)
        ? typeof item === "number" && Number.isFinite(item)
        : typeof item === "string")) &&
    (value.security === undefined || (isRecord(value.security) &&
      Object.values(value.security).every(item => typeof item === "string" ||
        typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item)))));
}

function hasSourceData(source: SourceResult): boolean {
  return [source.location, source.network, source.security ?? {}].some(group =>
    Object.values(group).some(value => value !== undefined && value !== null && value !== ""),
  );
}

export function sourceEntries(sources: Record<string, SourceResult>): Array<[string, SourceResult]> {
  return Object.entries(sources)
    .filter(([, source]) => hasSourceData(source))
    .sort(([left], [right]) => left.localeCompare(right));
}

export function sourceOptions(entries: Array<[string, SourceResult]>, t: Translate) {
  return entries.map(([id, source]) => ({
    id, label: source.label, network: networkSummary(source, t),
    location: locationSummary(source, t), countryCode: source.location.countryCode,
  }));
}

export function text(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

export function coordinate(value: number | undefined): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : null;
}

export function coordinates(source: SourceResult): string | null {
  const latitude = coordinate(source.location.latitude);
  const longitude = coordinate(source.location.longitude);
  return latitude !== null && longitude !== null
    ? `${latitude}, ${longitude}`
    : null;
}

export function locationSummary(source: SourceResult, t: Translate): string {
  if (text(source.location.description)) return source.location.description!.trim();
  const parts = [
    source.location.city,
    source.location.region,
    source.location.country,
  ]
    .map(text)
    .filter((item): item is string => Boolean(item));
  return parts.join(", ") || t("未提供", "Not provided");
}

export function networkSummary(source: SourceResult, t: Translate): string {
  return (
    text(source.network.organization) ||
    text(source.network.isp) ||
    text(source.network.description) ||
    text(source.network.asn) ||
    t("未提供", "Not provided")
  );
}

export function sourceScore(source: SourceResult): number {
  const locationValues = Object.values(source.location).filter(
    (value) => value !== undefined && value !== null && value !== "",
  ).length;
  const networkValues = Object.values(source.network).filter(
    (value) => value !== undefined && value !== null && value !== "",
  ).length;
  return locationValues + networkValues;
}

export function bestSource(entries: Array<[string, SourceResult]>): string {
  return (
    entries.reduce(
      (best, entry) =>
        sourceScore(entry[1]) > sourceScore(best[1]) ? entry : best,
      entries[0],
    )?.[0] ?? ""
  );
}
