"use client";

import { SourcePicker, SourceData } from "@/components/source-data";

import { CountryLabel } from "@/components/country-flag";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";

import { useLocale, type Translate } from "@/components/locale";
import {
  CopyButton,
  DataPanel,
  DataRow,
  LookupForm,
  StatusNotice,
  Workspace,
} from "@/components/workspace";
import type { QueryResult, SourceResult } from "@/modules/query/types";

type LookupError =
  "invalid-ip" | "invalid-response" | "request-failed" | "unavailable";

export interface GeoLookupProps {
  initialIp?: string;
  initialExternal?: boolean;
  rootCompatibility?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isQueryResult(value: unknown): value is QueryResult {
  return (
    isRecord(value) &&
    typeof value.ip === "string" &&
    typeof value.generation === "string" &&
    typeof value.timestamp === "string" &&
    ["ok", "partial", "unavailable"].includes(String(value.status)) &&
    isRecord(value.errors) &&
    Object.values(value.errors).every((item) => typeof item === "string") &&
    isRecord(value.sources) &&
    Object.values(value.sources).every(
      (source) =>
        isRecord(source) &&
        typeof source.label === "string" &&
        isRecord(source.location) &&
        isRecord(source.network) &&
        Object.values(source.network).every(
          (item) => item == null || typeof item === "string",
        ) &&
        Object.entries(source.location).every(
          ([key, item]) =>
            item == null ||
            (["latitude", "longitude"].includes(key)
              ? typeof item === "number" && Number.isFinite(item)
              : typeof item === "string"),
        ),
    )
  );
}

function text(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function coordinate(value: number | undefined): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : null;
}

function coordinates(source: SourceResult): string | null {
  const latitude = coordinate(source.location.latitude);
  const longitude = coordinate(source.location.longitude);
  return latitude !== null && longitude !== null
    ? `${latitude}, ${longitude}`
    : null;
}

function locationSummary(source: SourceResult, t: Translate): string {
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

function networkSummary(source: SourceResult, t: Translate): string {
  return (
    text(source.network.organization) ||
    text(source.network.isp) ||
    text(source.network.description) ||
    text(source.network.asn) ||
    t("未提供", "Not provided")
  );
}

function sourceScore(source: SourceResult): number {
  const locationValues = Object.values(source.location).filter(
    (value) => value !== undefined && value !== null && value !== "",
  ).length;
  const networkValues = Object.values(source.network).filter(
    (value) => value !== undefined && value !== null && value !== "",
  ).length;
  return locationValues + networkValues;
}

function bestSource(entries: Array<[string, SourceResult]>): string {
  return (
    entries.reduce(
      (best, entry) =>
        sourceScore(entry[1]) > sourceScore(best[1]) ? entry : best,
      entries[0],
    )?.[0] ?? ""
  );
}

function errorMessage(error: LookupError, ip: string, t: Translate): string {
  if (error === "invalid-ip") {
    return t(
      "请输入有效的 IPv4 或 IPv6 地址。",
      "Enter a valid IPv4 or IPv6 address.",
    );
  }
  if (error === "invalid-response") {
    return t(
      `查询 ${ip} 收到无法识别的响应，请重试。`,
      `The response for ${ip} could not be read. Try again.`,
    );
  }
  if (error === "request-failed") {
    return t(
      `无法查询 ${ip}，请检查连接后重试。`,
      `Could not look up ${ip}. Check your connection and try again.`,
    );
  }
  return t(
    `未找到 ${ip} 的可用结果，请重试。`,
    `No usable result was found for ${ip}. Try again.`,
  );
}

function DetailPanels({ ip, source }: { ip: string; source: SourceResult }) {
  const { t } = useLocale();
  const version = ip.includes(":") ? "IPv6" : "IPv4";
  const country = text(source.location.country);
  const countryCode = text(source.location.countryCode);
  const countryRegion = [country, countryCode && `(${countryCode})`]
    .filter(Boolean)
    .join(" ");
  const asn = text(source.network.asn);

  return (
    <>
      <DataPanel
        title={ip}
        actions={
          <>
            <Link href={`/whois/${encodeURIComponent(ip)}`}>
              Whois
            </Link>
            <span className="ip-version">{version}</span>
            <CopyButton value={ip} label={t("复制 IP", "Copy IP")} compact />
          </>
        }
      >
        <DataRow mono label={t("地址", "Address")} value={ip} copyValue={ip} />
        {text(source.location.continent) && (
          <DataRow
            label={t("洲", "Continent")}
            value={text(source.location.continent)}
          />
        )}
        {countryRegion && (
          <DataRow
            label={t("国家或地区", "Country or region")}
            value={countryRegion}
          />
        )}
        {text(source.location.region) && (
          <DataRow
            label={t("地区", "Region")}
            value={text(source.location.region)}
          />
        )}
        {text(source.location.city) && (
          <DataRow
            label={t("城市", "City")}
            value={text(source.location.city)}
          />
        )}
        {text(source.location.timezone) && (
          <DataRow mono
            label={t("时区", "Time Zone")}
            value={text(source.location.timezone)}
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
        {text(source.network.isp) && (
          <DataRow label="ISP" value={text(source.network.isp)} />
        )}
        {text(source.network.organization) && (
          <DataRow
            label={t("IP 组织", "IP Organization")}
            value={text(source.network.organization)}
          />
        )}
        {asn && (
          <DataRow mono
            label="ASN"
            value={asn.toUpperCase().startsWith("AS") ? asn : `AS${asn}`}
          />
        )}
        {text(source.network.route) && (
          <DataRow mono
            label={t("路由", "Route")}
            value={text(source.network.route)}
          />
        )}
        {text(source.network.domain) && (
          <DataRow mono
            label={t("域名", "Domain")}
            value={text(source.network.domain)}
          />
        )}
        {text(source.network.handle) && (
          <DataRow mono
            label={t("网络标识", "Network handle")}
            value={text(source.network.handle)}
          />
        )}
        {text(source.network.description) && (
          <DataRow
            label={t("描述", "Description")}
            value={text(source.network.description)}
          />
        )}
        {!Object.values(source.network).some(
          (value) => value !== undefined && value !== null && value !== "",
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

export function GeoLookup({
  initialIp = "",
  initialExternal = true,
  rootCompatibility = false,
}: GeoLookupProps) {
  const { t } = useLocale();
  const [input, setInput] = useState(initialIp);
  const [external, setExternal] = useState(initialExternal);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [selectedSource, setSelectedSource] = useState("");
  const [pendingIp, setPendingIp] = useState("");
  const [failure, setFailure] = useState<{
    kind: LookupError;
    ip: string;
  } | null>(null);
  const [stale, setStale] = useState(false);
  const sequence = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const resultRef = useRef<QueryResult | null>(null);

  const entries = useMemo(
    () =>
      Object.entries(result?.sources ?? {})
        .filter(([, source]) => sourceScore(source) > 0)
        .sort(([left], [right]) => left.localeCompare(right)),
    [result],
  );
  const currentSource =
    entries.find(([key]) => key === selectedSource) ?? entries[0];

  const runLookup = useCallback(
    async (rawIp: string, includeExternal: boolean, updateUrl: boolean) => {
      const ip = rawIp.trim();
      const requestId = ++sequence.current;
      activeController.current?.abort();
      setFailure(null);
      setStale(Boolean(resultRef.current));

      if (!ip || !/^[\da-fA-F:.]+$/.test(ip)) {
        setPendingIp("");
        setFailure({ kind: "invalid-ip", ip });
        return;
      }

      const controller = new AbortController();
      activeController.current = controller;
      setPendingIp(ip);

      if (updateUrl) {
        const nextUrl = rootCompatibility
          ? `/?ip=${encodeURIComponent(ip)}${
              includeExternal ? "" : "&external=false"
            }`
          : `/geoip/${encodeURIComponent(ip)}${
              includeExternal ? "" : "?external=false"
            }`;
        window.history.pushState({}, "", nextUrl);
      }

      try {
        const response = await fetch(
          `/api/ip/${encodeURIComponent(ip)}${
            includeExternal ? "" : "?external=false"
          }`,
          { signal: controller.signal },
        );
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          if (requestId === sequence.current) {
            setFailure({ kind: "invalid-response", ip });
          }
          return;
        }

        if (requestId !== sequence.current || controller.signal.aborted) return;
        if ((response.ok || response.status === 503) && isQueryResult(body) && body.ip === ip) {
          const nextEntries = Object.entries(body.sources)
            .filter(([, source]) => sourceScore(source) > 0)
            .sort(([left], [right]) => left.localeCompare(right));
          if (nextEntries.length === 0) {
            setFailure({ kind: "unavailable", ip });
            return;
          }
          resultRef.current = body;
          setResult(body);
          setSelectedSource(bestSource(nextEntries));
          setStale(false);
          return;
        }

        setFailure({
          kind: response.status === 400 ? "invalid-ip" : "unavailable",
          ip,
        });
      } catch (error) {
        if (
          requestId !== sequence.current ||
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        setFailure({ kind: "request-failed", ip });
      } finally {
        if (requestId === sequence.current) {
          setPendingIp("");
          activeController.current = null;
        }
      }
    },
    [rootCompatibility],
  );

  useEffect(() => {
    const routeTarget = () => {
      let ip = initialIp;
      let includeExternal = initialExternal;
      const params = new URLSearchParams(window.location.search);
      includeExternal = params.get("external") !== "false";
      if (rootCompatibility) {
        ip = params.get("ip") ?? "";
      } else {
        ip = "";
        const match = /^\/geoip\/([^/]+)$/.exec(window.location.pathname);
        if (match) {
          try {
            ip = decodeURIComponent(match[1]);
          } catch {
            ip = match[1];
          }
        }
      }
      return { ip, includeExternal };
    };

    const restore = () => {
      const target = routeTarget();
      setInput(target.ip);
      setExternal(target.includeExternal);
      if (target.ip) {
        void runLookup(target.ip, target.includeExternal, false);
      } else {
        sequence.current += 1;
        activeController.current?.abort();
        resultRef.current = null;
        setResult(null);
        setSelectedSource("");
        setPendingIp("");
        setFailure(null);
        setStale(false);
      }
    };

    restore();
    window.addEventListener("popstate", restore);

    return () => {
      sequence.current += 1;
      activeController.current?.abort();
      window.removeEventListener("popstate", restore);
    };
  }, [initialExternal, initialIp, rootCompatibility, runLookup]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runLookup(input, external, true);
  }

  const lookupForm = (
    <LookupForm
      id="geoip-address"
      value={input}
      onChange={setInput}
      onSubmit={submit}
      isLoading={Boolean(pendingIp)}
      label={t("IP 地址", "IP address")}
      placeholder={t("IPv4 或 IPv6 地址", "IPv4 or IPv6 address")}
    />
  );

  return (
    <Workspace active="geoip">
      <div
        className={`lookup-page ${result ? "has-result" : "is-empty"}`}
        aria-busy={Boolean(pendingIp)}
      >
        {!result && (
          <header className="lookup-intro">
            <h1 className="lookup-title">
              {t("GeoIP 查询 - IP 地理位置", "GeoIP Lookup - IP Geolocation")}
            </h1>
            {lookupForm}
            <p className="lookup-description">
              {t(
                "查询任意 IPv4 或 IPv6 地址的网络归属与估计位置。",
                "Look up the network and estimated location of any IPv4 or IPv6 address.",
              )}
            </p>
          </header>
        )}
        {result && (
          <>
            <h1 className="sr-only">
              {t("GeoIP 查询结果", "GeoIP lookup result")}
            </h1>
            {lookupForm}
          </>
        )}

        <div aria-live="polite">
          {pendingIp && (
            <StatusNotice>
              {t("正在查询 ", "Looking up ")}
              <span className="mono">{pendingIp}</span>…
            </StatusNotice>
          )}
          {failure && (
            <StatusNotice tone="error">
              {errorMessage(failure.kind, failure.ip, t)}
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

        {result && currentSource && (
          <div className="lookup-results">
            <div className="result-actions">
              <SourcePicker sources={entries.map(([key, source]) => ({ id: key, label: source.label, network: networkSummary(source, t), location: locationSummary(source, t), countryCode: source.location.countryCode }))} selected={currentSource[0]} onChange={setSelectedSource} />
              <CopyButton
                value={JSON.stringify(result, null, 2)}
                label={t("复制完整 JSON", "Copy full JSON")}
                compact
              />
            </div>

            <DetailPanels ip={result.ip} source={currentSource[1]} />

            <SourceData sources={entries.map(([key, source]) => ({ id: key, label: source.label, network: networkSummary(source, t), location: locationSummary(source, t), countryCode: source.location.countryCode }))} selected={currentSource[0]} raw={result} />
          </div>
        )}
      </div>
    </Workspace>
  );
}

export default GeoLookup;
