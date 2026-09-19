"use client";

import { SourcePicker, SourceData } from "@/components/source-data";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLocale, type Translate } from "@/components/locale";
import {
  CopyButton,
  StatusNotice,
  Workspace,
} from "@/components/workspace";
import { SourcePanels } from "@/components/source-panels";
import { bestSource, sourceEntries, sourceOptions } from "@/components/source-model";
import { parseObservation, type ObservationEnvelope } from "@/components/visitor-model";

type FailureKind =
  | "unrecognized-ip"
  | "service-unavailable"
  | "invalid-response"
  | "request-failed";

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
        const entries = sourceEntries(observation.sources);
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
      sourceEntries(result?.sources ?? {}),
    [result],
  );
  const options = sourceOptions(entries, t);
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
              <SourcePicker sources={options} selected={current[0]} onChange={setSelectedSource} />
              <CopyButton
                value={JSON.stringify(result, null, 2)}
                label={t("复制完整 JSON", "Copy full JSON")}
                compact
              />
            </div>

            <SourcePanels ip={result.ip} source={current[1]} visitor />

            <SourceData sources={options} selected={current[0]} raw={result} />
          </div>
        )}
      </div>
    </Workspace>
  );
}
