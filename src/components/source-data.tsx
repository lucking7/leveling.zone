"use client";

import { useId } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CountryLabel } from "./country-flag";
import { useLocale } from "./locale";

export interface SourceOption {
  id: string;
  label: string;
  network: string;
  location: string;
  countryCode?: string | null;
}

export function SourcePicker({ sources, selected, onChange }: {
  sources: SourceOption[]; selected: string; onChange: (id: string) => void;
}) {
  const { t } = useLocale();
  const id = useId();
  return <div className="source-picker">
    {sources.length > 1 ? <label htmlFor={id}>{t("数据来源", "Data source")}</label> : <span className="source-picker-label">{t("数据来源", "Data source")}</span>}
    {sources.length > 1 ? <span className="source-select">
      <select id={id} value={selected} onChange={event => onChange(event.target.value)}>
        {sources.map(source => <option key={source.id} value={source.id}>{source.label}</option>)}
      </select><ChevronDown size={14} aria-hidden="true" />
    </span> : <span className="single-source" id={id}>{sources[0]?.label}</span>}
  </div>;
}

export function SourceData({ sources, selected, raw }: {
  sources: SourceOption[]; selected: string; raw: unknown;
}) {
  const { t } = useLocale();
  return <>
    {sources.length > 1 && <details className="source-details source-comparison">
      <summary><span>{t("所有来源", "All sources")} <span className="source-count">{sources.length}</span></span></summary>
      <table className="source-table">
        <caption className="sr-only">{t("IP 数据来源对照", "IP data source comparison")}</caption>
        <thead><tr><th scope="col">{t("来源", "Source")}</th><th scope="col">{t("网络归属", "Network")}</th><th scope="col">{t("位置", "Location")}</th></tr></thead>
        <tbody>{sources.map(source => <tr key={source.id} data-selected={source.id === selected}>
          <th scope="row"><span className="source-name">{source.label}{source.id === selected && <span className="source-current"><Check size={14} aria-hidden="true" /><span className="sr-only">{t("当前来源", "Current source")}</span></span>}</span></th>
          <td data-label={t("网络归属", "Network")}>{source.network}</td>
          <td data-label={t("位置", "Location")}><CountryLabel code={source.countryCode}>{source.location}</CountryLabel></td>
        </tr>)}</tbody>
      </table>
    </details>}
    <details className="source-details source-raw">
      <summary>{t("原始 JSON", "Raw JSON")}</summary>
      <pre className="raw-json" tabIndex={0} role="region" aria-label={t("原始查询 JSON", "Raw lookup JSON")}>{JSON.stringify(raw, null, 2)}</pre>
    </details>
  </>;
}
