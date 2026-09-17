"use client";

import { SourcePicker, SourceData } from "@/components/source-data";

import { CountryLabel } from "@/components/country-flag";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLocale, type Translate } from "@/components/locale";
import {
  CopyButton,
  DataPanel,
  DataRow,
  StatusNotice,
  Workspace,
} from "@/components/workspace";
import type {
  ObservationFailureReason,
  ObservationSourceData,
  ObservationSummary,
} from "@/modules/observation/types";

interface ObservationEnvelope {
  ip: string;
  ipSource: string;
  sources: Record<string, ObservationSourceData>;
  observation: ObservationSummary;
  generation?: string;
  timestamp?: string;
  error?: string;
}

type FailureKind =
  | "unrecognized-ip"
  | "service-unavailable"
  | "invalid-response"
  | "request-failed";

const FAILURE_REASONS: readonly ObservationFailureReason[] = [
  "timeout",
  "http-error",
  "invalid-response",
  "network-error",
  "lookup-failed",
  "not-installed",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function scalar(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function parseSource(value: unknown): ObservationSourceData | null {
  if (!isRecord(value) || !isRecord(value.observation)) return null;
  if (
    value.observation.scope !== "request-ip" ||
    typeof value.observation.source !== "string" ||
    !value.observation.source
  ) {
    return null;
  }

  const location = optionalRecord(value.location);
  const network = optionalRecord(value.network);
  const security = optionalRecord(value.security);
  const accuracy = optionalRecord(value.accuracy);
  const meta = optionalRecord(value.meta);
  return {
    ...(typeof value.ip === "string" && { ip: value.ip }),
    ...(location && { location }),
    ...(network && { network }),
    ...(security && { security }),
    ...(accuracy && { accuracy }),
    ...(meta && { meta }),
    observation: {
      scope: "request-ip",
      source: value.observation.source,
    },
  };
}

function parseObservation(value: unknown): ObservationEnvelope | null {
  if (
    !isRecord(value) ||
    typeof value.ip !== "string" ||
    !value.ip ||
    typeof value.ipSource !== "string" ||
    !isRecord(value.sources) ||
    !isRecord(value.observation) ||
    value.observation.semantics !== "request-ip" ||
    !Array.isArray(value.observation.failures)
  ) {
    return null;
  }

  const requestCount = value.observation.requestIpSourceCount;
  const egressCount = value.observation.serverEgressSourceCount;
  if (
    typeof requestCount !== "number" ||
    !Number.isInteger(requestCount) ||
    requestCount < 0 ||
    egressCount !== 0
  ) {
    return null;
  }

  const failures = value.observation.failures.flatMap((failure) => {
    if (
      !isRecord(failure) ||
      typeof failure.source !== "string" ||
      !FAILURE_REASONS.includes(failure.reason as ObservationFailureReason)
    ) {
      return [];
    }
    return [
      {
        source: failure.source,
        reason: failure.reason as ObservationFailureReason,
      },
    ];
  });
  if (failures.length !== value.observation.failures.length) return null;

  const sources: Record<string, ObservationSourceData> = {};
  for (const [key, sourceValue] of Object.entries(value.sources)) {
    const source = parseSource(sourceValue);
    if (!source || source.ip !== value.ip) return null;
    sources[key] = source;
  }
  if (Object.keys(sources).length !== requestCount) return null;

  return {
    ip: value.ip,
    ipSource: value.ipSource,
    sources,
    observation: {
      semantics: "request-ip",
      requestIpSourceCount: requestCount,
      serverEgressSourceCount: 0,
      failures,
    },
    ...(typeof value.generation === "string" && {
      generation: value.generation,
    }),
    ...(typeof value.timestamp === "string" && { timestamp: value.timestamp }),
    ...(typeof value.error === "string" && { error: value.error }),
  };
}

function sourceName(key: string, source: ObservationSourceData): string {
  return source.observation.source.trim() || key;
}

function sourceScore(source: ObservationSourceData): number {
  return [source.location, source.network].reduce(
    (total, group) =>
      total +
      Object.values(group ?? {}).filter((value) => scalar(value) !== null)
        .length,
    0,
  );
}

function bestSource(entries: Array<[string, ObservationSourceData]>): string {
  return (
    entries.reduce(
      (best, entry) =>
        sourceScore(entry[1]) > sourceScore(best[1]) ? entry : best,
      entries[0],
    )?.[0] ?? ""
  );
}

function firstValue(
  record: Record<string, unknown> | undefined,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = scalar(record?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function coordinates(source: ObservationSourceData): string | null {
  const latitude = scalar(source.location?.latitude);
  const longitude = scalar(source.location?.longitude);
  return latitude !== null && longitude !== null
    ? `${latitude}, ${longitude}`
    : null;
}

function locationSummary(source: ObservationSourceData, t: Translate): string {
  const location = source.location;
  const description = firstValue(location, ["description"]);
  if (description) return description;
  const parts = [
    firstValue(location, ["city"]),
    firstValue(location, ["province", "region", "state"]),
    firstValue(location, ["country"]),
  ].filter((item): item is string => Boolean(item));
  return parts.join(", ") || t("未提供", "Not provided");
}

function networkSummary(source: ObservationSourceData, t: Translate): string {
  return (
    firstValue(source.network, ["organization", "isp", "description", "asn"]) ||
    t("未提供", "Not provided")
  );
}

function failureMessage(kind: FailureKind, t: Translate): string {
  const messages: Record<FailureKind, [string, string]> = {
    "unrecognized-ip": [
      "无法识别当前 IP，请重试。",
      "Could not identify your current IP. Try again.",
    ],
    "service-unavailable": [
      "当前 IP 查询服务暂不可用，请稍后重试。",
      "The IP lookup service is unavailable. Try again later.",
    ],
    "invalid-response": [
      "收到无法识别的响应，请重试。",
      "The response could not be read. Try again.",
    ],
    "request-failed": [
      "请求失败，请检查连接后重试。",
      "The request failed. Check your connection and try again.",
    ],
  };
  return t(...messages[kind]);
}

function SourcePanels({
  result,
  source,
}: {
  result: ObservationEnvelope;
  source: ObservationSourceData;
}) {
  const { t } = useLocale();
  const location = source.location;
  const network = source.network;
  const country = firstValue(location, ["country"]);
  const countryCode = firstValue(location, ["countryCode", "country_code"]);
  const countryRegion = [country, countryCode && `(${countryCode})`]
    .filter(Boolean)
    .join(" ");
  const asn = firstValue(network, ["asn"]);

  return (
    <>
      <DataPanel
        title={t("当前 IP", "Your IP")}
        actions={
          <CopyButton
            value={result.ip}
            label={t("复制 IP", "Copy IP")}
            compact
          />
        }
      >
        <DataRow mono
          label={t("地址", "Address")}
          value={result.ip}
          copyValue={result.ip}
        />
        <DataRow mono
          label={t("地址版本", "IP version")}
          value={result.ip.includes(":") ? "IPv6" : "IPv4"}
        />
        {firstValue(location, ["continent"]) && (
          <DataRow
            label={t("洲", "Continent")}
            value={firstValue(location, ["continent"])}
          />
        )}
        {countryRegion && (
          <DataRow
            label={t("国家或地区", "Country or region")}
            value={countryRegion}
          />
        )}
        {firstValue(location, ["region", "province", "state"]) && (
          <DataRow
            label={t("地区", "Region")}
            value={firstValue(location, ["region", "province", "state"])}
          />
        )}
        {firstValue(location, ["city"]) && (
          <DataRow
            label={t("城市", "City")}
            value={firstValue(location, ["city"])}
          />
        )}
        {firstValue(location, ["timezone", "time_zone", "timeZone"]) && (
          <DataRow mono
            label={t("时区", "Time zone")}
            value={firstValue(location, ["timezone", "time_zone", "timeZone"])}
          />
        )}
        {coordinates(source) && (
          <DataRow mono
            label={t("坐标", "Coordinates")}
            value={coordinates(source)}
            copyValue={coordinates(source) ?? undefined}
          />
        )}
        <DataRow
          label={t("位置", "Location")}
          value={<CountryLabel code={countryCode}>{locationSummary(source, t)}</CountryLabel>}
          copyValue={locationSummary(source, t)}
        />
      </DataPanel>

      <DataPanel title={t("网络", "Network")}>
        {firstValue(network, ["isp"]) && (
          <DataRow label="ISP" value={firstValue(network, ["isp"])} />
        )}
        {firstValue(network, ["organization"]) && (
          <DataRow
            label={t("IP 组织", "IP organization")}
            value={firstValue(network, ["organization"])}
          />
        )}
        {asn && (
          <DataRow mono
            label="ASN"
            value={asn.toUpperCase().startsWith("AS") ? asn : `AS${asn}`}
          />
        )}
        {firstValue(network, ["route"]) && (
          <DataRow mono
            label={t("路由", "Route")}
            value={firstValue(network, ["route"])}
          />
        )}
        {firstValue(network, ["domain"]) && (
          <DataRow mono
            label={t("域名", "Domain")}
            value={firstValue(network, ["domain"])}
          />
        )}
        {firstValue(network, ["handle"]) && (
          <DataRow mono
            label={t("网络标识", "Network handle")}
            value={firstValue(network, ["handle"])}
          />
        )}
        {firstValue(network, ["description"]) && (
          <DataRow
            label={t("描述", "Description")}
            value={firstValue(network, ["description"])}
          />
        )}
        {!Object.values(network ?? {}).some(
          (value) => scalar(value) !== null,
        ) && (
          <DataRow
            label={t("网络", "Network")}
            value={t("未提供", "Not provided")}
          />
        )}
      </DataPanel>
    </>
  );
}

export default function MyIpPage() {
  const { t } = useLocale();
  const [result, setResult] = useState<ObservationEnvelope | null>(null);
  const [selectedSource, setSelectedSource] = useState("");
  const [failure, setFailure] = useState<FailureKind | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const sequence = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const resultRef = useRef<ObservationEnvelope | null>(null);

  const load = useCallback(async () => {
    const requestId = ++sequence.current;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    setIsLoading(true);
    setFailure(null);
    setStale(Boolean(resultRef.current));

    try {
      const response = await fetch("/api/myip", {
        cache: "no-store",
        signal: controller.signal,
      });
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        if (requestId === sequence.current) setFailure("invalid-response");
        return;
      }

      if (requestId !== sequence.current || controller.signal.aborted) return;
      const observation = parseObservation(body);
      if ((response.ok || response.status === 503) && observation) {
        const entries = Object.entries(observation.sources)
          .filter(([, source]) => sourceScore(source) > 0)
          .sort(([left], [right]) => left.localeCompare(right));
        if (entries.length === 0) {
          setFailure("service-unavailable");
          return;
        }
        resultRef.current = observation;
        setResult(observation);
        setSelectedSource(bestSource(entries));
        setStale(false);
        return;
      }

      setFailure(
        response.status === 400
          ? "unrecognized-ip"
          : response.status >= 500
            ? "service-unavailable"
            : "invalid-response",
      );
    } catch (error) {
      if (
        requestId !== sequence.current ||
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        return;
      }
      setFailure("request-failed");
    } finally {
      if (requestId === sequence.current) {
        setIsLoading(false);
        activeController.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      sequence.current += 1;
      activeController.current?.abort();
    };
  }, [load]);

  const entries = useMemo(
    () =>
      Object.entries(result?.sources ?? {})
        .filter(([, source]) => sourceScore(source) > 0)
        .sort(([left], [right]) => left.localeCompare(right)),
    [result],
  );
  const current = entries.find(([key]) => key === selectedSource) ?? entries[0];

  return (
    <Workspace active="myip">
      <div className="lookup-page myip-page" aria-busy={isLoading}>
        <header className="lookup-intro">
          <h1 className="lookup-title">{t("我的 IP", "My IP")}</h1>
          <p className="lookup-description">
            {t(
              "查看此连接向本站公开的 IP、网络归属与估计位置。",
              "See the IP this connection exposes to this site, its network and estimated location.",
            )}
          </p>
        </header>

        <div className="result-actions">
          <span>
            {isLoading
              ? t("正在查询当前 IP…", "Looking up your current IP…")
              : stale
                ? t("上次查询结果", "Previous result")
                : result
                  ? t("当前连接", "Current connection")
                  : t("暂时无法查询", "Lookup unavailable")}
          </span>
          <button
            type="button"
            className="notice-action"
            onClick={() => void load()}
            disabled={isLoading}
          >
            {isLoading ? t("查询中…", "Looking up…") : t("重试", "Try again")}
          </button>
        </div>

        <div aria-live="polite">
          {failure && (
            <StatusNotice tone="error">
              {failureMessage(failure, t)}
            </StatusNotice>
          )}
          {stale && result && (
            <StatusNotice tone="warning">
              {t(
                "当前显示上次查询结果，请重试以获取新结果。",
                "Showing the previous result. Try again for a new result.",
              )}
            </StatusNotice>
          )}
        </div>

        {result && current && (
          <div className="lookup-results">
            <div className="result-actions">
              <SourcePicker sources={entries.map(([key, source]) => ({ id: key, label: sourceName(key, source), network: networkSummary(source, t), location: locationSummary(source, t), countryCode: firstValue(source.location, ["countryCode", "country_code"]) }))} selected={current[0]} onChange={setSelectedSource} />
              <CopyButton
                value={JSON.stringify(result, null, 2)}
                label={t("复制完整 JSON", "Copy full JSON")}
                compact
              />
            </div>

            <SourcePanels result={result} source={current[1]} />

            <SourceData sources={entries.map(([key, source]) => ({ id: key, label: sourceName(key, source), network: networkSummary(source, t), location: locationSummary(source, t), countryCode: firstValue(source.location, ["countryCode", "country_code"]) }))} selected={current[0]} raw={result} />
          </div>
        )}
      </div>
    </Workspace>
  );
}
