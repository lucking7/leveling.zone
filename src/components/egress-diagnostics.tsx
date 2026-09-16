"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Play, RotateCw } from "lucide-react";
import { CountryLabel } from "./country-flag";
import { useLocale, type Translate } from "./locale";
import { CopyButton, Workspace } from "./workspace";
import { EGRESS_SOURCES, runEgressSources, type EgressResult } from "@/modules/egress";

const sourceOrder = new Map(EGRESS_SOURCES.map((source, index) => [source.id, index]));

function ResultsTable({ results, t }: { results: EgressResult[]; t: Translate }) {
  if (!results.length) return null;
  return <section className="egress-results" aria-labelledby="egress-results-title" data-testid="egress-results">
    <header className="egress-results-heading">
      <h2 id="egress-results-title">{t("检测结果", "Results")}</h2>
      <span className="source-count">{results.length}</span>
    </header>
    <div className="egress-table-wrap">
      <table className="egress-table">
        <caption className="sr-only">{t("出口检测结果", "Egress check results")}</caption>
        <thead><tr>
          <th scope="col">{t("来源", "Source")}</th>
          <th scope="col">IP</th>
          <th scope="col">{t("网络", "Network")}</th>
          <th scope="col">{t("估计位置", "Estimated location")}</th>
          <th scope="col"><span className="sr-only">{t("操作", "Action")}</span></th>
        </tr></thead>
        <tbody>{results.map((result) => <tr key={result.id}>
          <th scope="row">{result.name}</th>
          <td className="mono" data-label="IP">
            <span className="egress-ip-value">
              <Link href={`/geoip/${encodeURIComponent(result.ip)}`}>{result.ip}</Link>
              <span className="egress-family-badge">{result.family === "ipv4" ? "IPv4" : "IPv6"}</span>
            </span>
          </td>
          <td data-label={t("网络", "Network")}>{result.network || t("未提供", "Not provided")}</td>
          <td data-label={t("估计位置", "Estimated location")}><CountryLabel code={result.countryCode}>{result.location || t("未提供", "Not provided")}</CountryLabel></td>
          <td className="egress-copy-cell"><CopyButton value={result.ip} label={t(`复制 ${result.name} IP`, `Copy ${result.name} IP`)} compact /></td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

export function EgressDiagnostics() {
  const { t } = useLocale();
  const [state, setState] = useState<"idle" | "loading" | "success" | "empty">("idle");
  const [completed, setCompleted] = useState(0);
  const [results, setResults] = useState<EgressResult[]>([]);
  const activeRun = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => {
    activeRun.current += 1;
    controller.current?.abort();
  }, []);

  async function run() {
    controller.current?.abort();
    const runId = ++activeRun.current;
    const nextController = new AbortController();
    controller.current = nextController;
    const collected = new Map<string, EgressResult>();
    setResults([]);
    setCompleted(0);
    setState("loading");

    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    if (runId !== activeRun.current) return;

    try {
      await runEgressSources({
        sources: EGRESS_SOURCES,
        signal: nextController.signal,
        concurrency: 6,
        onResult(result) {
          if (runId !== activeRun.current) return;
          collected.set(result.id, result);
          setResults([...collected.values()].sort((a, b) =>
            (sourceOrder.get(a.id) ?? 0) - (sourceOrder.get(b.id) ?? 0),
          ));
        },
        onSettled() {
          if (runId === activeRun.current) setCompleted((value) => value + 1);
        },
      });
    } catch {
      if (runId !== activeRun.current || nextController.signal.aborted) return;
    }

    if (runId !== activeRun.current) return;
    controller.current = null;
    setState(collected.size ? "success" : "empty");
  }

  const loading = state === "loading";
  return <Workspace active="egress">
    <div className="lookup-page egress-page" aria-busy={loading}>
      <header className="egress-intro">
        <h1 className="lookup-title">{t("出口检测", "Egress check")}</h1>
        <p className="lookup-description">{t("查看不同网站看到的 IP。", "See the IP addresses reported by different websites.")}</p>
        <button id="egress-start" className="primary-button egress-start" type="button" onClick={run} disabled={loading}>
          {loading ? <LoaderCircle className="egress-spinner" size={16} aria-hidden="true" /> : state === "idle" ? <Play size={15} aria-hidden="true" /> : <RotateCw size={15} aria-hidden="true" />}
          {loading ? t("检测中…", "Checking…") : state === "idle" ? t("开始检测", "Start check") : t("重新检测", "Check again")}
        </button>
      </header>

      {state !== "idle" && <div className={`egress-status${loading ? " egress-loading" : ""}`} role="status" aria-live="polite" aria-atomic="true" data-testid="egress-status">
        {loading && <LoaderCircle className="egress-spinner" size={16} aria-hidden="true" />}
        <span>{loading
          ? t(`正在检测 ${completed}/${EGRESS_SOURCES.length}`, `Checking ${completed}/${EGRESS_SOURCES.length}`)
          : t(`已完成，${results.length} 个来源返回结果`, `Complete, ${results.length} sources returned results`)}</span>
      </div>}

      <ResultsTable results={results} t={t} />

      {state === "empty" && <div className="notice notice-error egress-empty" role="alert" data-testid="egress-empty">
        <p>{t("没有服务返回可用结果。当前浏览器或网络可能阻止了这些跨站请求。", "No service returned a usable result. This browser or network may be blocking the cross-site requests.")}</p>
        <button id="egress-retry" className="secondary-button" type="button" onClick={run}><RotateCw size={15} aria-hidden="true" />{t("重试", "Retry")}</button>
      </div>}
    </div>
  </Workspace>;
}
