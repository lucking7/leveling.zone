"use client";

import { SourcePicker, SourceData } from "@/components/source-data";

import { SourcePanels } from "./source-panels";
import { bestSource, isRecord, isSourceResult, sourceEntries, sourceOptions } from "./source-model";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useLocale, type Translate } from "@/components/locale";
import {
  CopyButton,
  LookupForm,
  StatusNotice,
  Workspace,
} from "@/components/workspace";
import type { QueryResult } from "@/modules/query/types";

type LookupError =
  "invalid-ip" | "invalid-response" | "request-failed" | "unavailable";

export interface GeoLookupProps {
  initialIp?: string;
  initialExternal?: boolean;
  rootCompatibility?: boolean;
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
    Object.values(value.sources).every(isSourceResult)
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
      sourceEntries(result?.sources ?? {}),
    [result],
  );
  const options = sourceOptions(entries, t);
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
          const nextEntries = sourceEntries(body.sources);
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
              <SourcePicker sources={options} selected={currentSource[0]} onChange={setSelectedSource} />
              <CopyButton
                value={JSON.stringify(result, null, 2)}
                label={t("复制完整 JSON", "Copy full JSON")}
                compact
              />
            </div>

            <SourcePanels ip={result.ip} source={currentSource[1]} />

            <SourceData sources={options} selected={currentSource[0]} raw={result} />
          </div>
        )}
      </div>
    </Workspace>
  );
}

export default GeoLookup;
