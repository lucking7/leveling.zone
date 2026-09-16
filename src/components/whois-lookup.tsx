"use client";

import { CountryLabel } from "./country-flag";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import type {
  RdapEntity,
  RdapErrorCode,
  RdapEvent,
  RdapResult,
  RdapTextBlock,
} from "@/modules/rdap/types";
import { useLocale } from "./locale";
import {
  CopyButton,
  DataPanel,
  DataRow,
  LookupForm,
  StatusNotice,
  Workspace,
} from "./workspace";

type FailureKind =
  | RdapErrorCode
  | "VALIDATION"
  | "MALFORMED_RESPONSE"
  | "NETWORK_ERROR"
  | "HTTP_ERROR";

interface Failure {
  kind: FailureKind;
  status?: number;
}

interface WhoisLookupProps {
  initialIp?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isTextBlock(value: unknown): value is RdapTextBlock {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    isStringArray(value.description)
  );
}

function isEntity(value: unknown): value is RdapEntity {
  return (
    isRecord(value) &&
    typeof value.handle === "string" &&
    typeof value.name === "string" &&
    isStringArray(value.roles) &&
    isStringArray(value.emails) &&
    isStringArray(value.phones) &&
    typeof value.address === "string"
  );
}

function isEvent(value: unknown): value is RdapEvent {
  return (
    isRecord(value) &&
    typeof value.action === "string" &&
    typeof value.date === "string"
  );
}

function isRdapResult(value: unknown): value is RdapResult {
  if (!isRecord(value) || !isRecord(value.network) || !isRecord(value.raw)) {
    return false;
  }

  const network = value.network;
  const stringFields = [
    "handle",
    "name",
    "type",
    "startAddress",
    "endAddress",
    "ipVersion",
    "country",
    "parentHandle",
  ];

  return (
    typeof value.ip === "string" &&
    typeof value.registry === "string" &&
    typeof value.endpoint === "string" &&
    stringFields.every((field) => typeof network[field] === "string") &&
    isStringArray(network.cidrs) &&
    Array.isArray(value.entities) &&
    value.entities.every(isEntity) &&
    Array.isArray(value.events) &&
    value.events.every(isEvent) &&
    Array.isArray(value.remarks) &&
    value.remarks.every(isTextBlock) &&
    Array.isArray(value.notices) &&
    value.notices.every(isTextBlock) &&
    Array.isArray(value.links) &&
    value.links.every(
      (link) =>
        isRecord(link) &&
        typeof link.title === "string" &&
        typeof link.href === "string",
    )
  );
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts.every(
      (part) =>
        /^(0|[1-9]\d{0,2})$/.test(part) &&
        Number(part) >= 0 &&
        Number(part) <= 255,
    )
  );
}

function isIpv6(value: string): boolean {
  if (
    !value.includes(":") ||
    value.includes("%") ||
    /[^0-9a-f:.]/i.test(value)
  ) {
    return false;
  }

  let candidate = value;
  if (candidate.includes(".")) {
    const separator = candidate.lastIndexOf(":");
    if (separator < 0 || !isIpv4(candidate.slice(separator + 1))) return false;
    candidate = `${candidate.slice(0, separator)}:0:0`;
  }

  if ((candidate.match(/::/g) ?? []).length > 1) return false;
  const hasCompression = candidate.includes("::");
  const parts = hasCompression
    ? candidate.split("::").flatMap((side) => (side ? side.split(":") : []))
    : candidate.split(":");

  if (parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) return false;
  return hasCompression ? parts.length < 8 : parts.length === 8;
}

function isIpAddress(value: string): boolean {
  return isIpv4(value) || isIpv6(value);
}

function safeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function eventMatches(action: string, kind: "registered" | "updated"): boolean {
  const normalized = action.toLowerCase().replace(/[\s_-]+/g, " ");
  return kind === "registered"
    ? /registration|registered/.test(normalized)
    : /last changed|last update|updated|update/.test(normalized);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

function joinNonEmpty(values: string[]): string {
  return values.filter(Boolean).join(", ");
}

function roleLabel(
  role: string,
  t: (zh: string, en: string) => string,
): string {
  switch (role.toLowerCase()) {
    case "registrant":
      return t("注册人", "Registrant");
    case "administrative":
      return t("管理联系人", "Admin Contact");
    case "technical":
      return t("技术联系人", "Tech Contact");
    case "abuse":
      return t("滥用举报联系人", "Abuse Contact");
    case "noc":
      return t("网络运营联系人", "NOC contact");
    default:
      return role || t("联系人", "Contact");
  }
}

function EntityIdentity({ entity }: { entity: RdapEntity }) {
  const showHandle = entity.handle && entity.handle !== entity.name;

  return (
    <span>
      {entity.name}
      {entity.name && showHandle && ", "}
      {showHandle && <span className="mono">{entity.handle}</span>}
    </span>
  );
}

function displayAddress(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");
}

function DescriptionBlock({ block }: { block: RdapTextBlock }) {
  return (
    <div className="rdap-lines">
      {block.description.filter(Boolean).map((line, index) => (
        <span key={`${index}-${line}`}>{line}</span>
      ))}
    </div>
  );
}

export function WhoisLookup({ initialIp = "" }: WhoisLookupProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [input, setInput] = useState(initialIp);
  const [result, setResult] = useState<RdapResult | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const requestRevision = useRef(0);

  const runLookup = useCallback(async (ip: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const revision = ++requestRevision.current;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15_000);

    setIsLoading(true);
    setFailure(null);

    try {
      const response = await fetch(`/api/rdap/${encodeURIComponent(ip)}`, {
        headers: { Accept: "application/rdap+json, application/json" },
        signal: controller.signal,
      });
      const bodyText = await response.text();
      let body: unknown;
      try {
        body = JSON.parse(bodyText);
      } catch {
        if (revision === requestRevision.current) {
          setFailure({ kind: "MALFORMED_RESPONSE", status: response.status });
        }
        return;
      }

      if (revision !== requestRevision.current) return;
      if (!response.ok) {
        const code =
          isRecord(body) &&
          typeof body.code === "string" &&
          [
            "INVALID_IP",
            "NOT_FOUND",
            "RATE_LIMITED",
            "UPSTREAM_ERROR",
            "UPSTREAM_TIMEOUT",
          ].includes(body.code)
            ? (body.code as RdapErrorCode)
            : "HTTP_ERROR";
        setFailure({ kind: code, status: response.status });
        return;
      }

      if (!isRdapResult(body) || body.ip !== ip) {
        setFailure({ kind: "MALFORMED_RESPONSE", status: response.status });
        return;
      }

      setResult(body);
      setFailure(null);
    } catch (error) {
      if (revision !== requestRevision.current) return;
      if (
        error instanceof DOMException &&
        error.name === "AbortError" &&
        !timedOut
      ) {
        return;
      }
      setFailure({ kind: timedOut ? "UPSTREAM_TIMEOUT" : "NETWORK_ERROR" });
    } finally {
      window.clearTimeout(timeout);
      if (revision === requestRevision.current) {
        setIsLoading(false);
        controllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const routeIp = initialIp.trim();
    setInput(initialIp);
    if (!routeIp) {
      controllerRef.current?.abort();
      requestRevision.current++;
      setResult(null);
      setFailure(null);
      setIsLoading(false);
      return;
    }
    if (!isIpAddress(routeIp)) {
      controllerRef.current?.abort();
      requestRevision.current++;
      setIsLoading(false);
      setFailure({ kind: "VALIDATION" });
      return;
    }
    void runLookup(routeIp);
  }, [initialIp, runLookup]);

  useEffect(
    () => () => {
      requestRevision.current++;
      controllerRef.current?.abort();
    },
    [],
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ip = input.trim();
    setInput(ip);
    if (!isIpAddress(ip)) {
      controllerRef.current?.abort();
      requestRevision.current++;
      setIsLoading(false);
      setFailure({ kind: "VALIDATION" });
      return;
    }

    if (ip === initialIp.trim()) {
      void runLookup(ip);
      return;
    }
    router.push(`/whois/${encodeURIComponent(ip)}`);
  };

  const retry = () => {
    const ip = input.trim();
    if (isIpAddress(ip)) void runLookup(ip);
  };

  const failureMessage = failure
    ? {
        VALIDATION: t(
          "请输入完整有效的 IPv4 或 IPv6 地址。",
          "Enter a complete, valid IPv4 or IPv6 address.",
        ),
        INVALID_IP: t(
          "这个地址无法查询，请检查 IPv4 或 IPv6 格式。",
          "This address cannot be queried. Check the IPv4 or IPv6 format.",
        ),
        NOT_FOUND: t(
          "注册局没有找到这个地址的 RDAP 记录。",
          "The registry did not return an RDAP record for this address.",
        ),
        RATE_LIMITED: t(
          "注册局暂时限制了查询频率，请稍后重试。",
          "The registry is temporarily rate limiting requests. Try again shortly.",
        ),
        UPSTREAM_ERROR: t(
          "注册局服务暂时不可用，请重试。",
          "The registry service is temporarily unavailable. Try again.",
        ),
        UPSTREAM_TIMEOUT: t(
          "注册局响应超时，请重试。",
          "The registry took too long to respond. Try again.",
        ),
        MALFORMED_RESPONSE: t(
          "收到无法识别的 RDAP 响应，请重试。",
          "The RDAP response could not be read. Try again.",
        ),
        NETWORK_ERROR: t(
          "查询失败，请检查网络连接后重试。",
          "The lookup failed. Check your connection and try again.",
        ),
        HTTP_ERROR: t(
          `查询失败（HTTP ${failure.status ?? "?"}），请重试。`,
          `The lookup failed (HTTP ${failure.status ?? "?"}). Try again.`,
        ),
      }[failure.kind]
    : "";

  const registeredEvent = result?.events.find((event) =>
    eventMatches(event.action, "registered"),
  );
  const updatedEvent = result?.events.find((event) =>
    eventMatches(event.action, "updated"),
  );
  const otherEvents =
    result?.events.filter(
      (event) =>
        !eventMatches(event.action, "registered") &&
        !eventMatches(event.action, "updated"),
    ) ?? [];
  const holder = result?.entities.find(
    (entity) =>
      entity.name &&
      entity.roles.some((role) => role.toLowerCase() === "registrant"),
  );
  const visibleEntities =
    result?.entities.filter(
      (entity) =>
        entity.name ||
        entity.handle ||
        entity.emails.length ||
        entity.phones.length ||
        entity.address,
    ) ?? [];
  const range = result
    ? result.network.startAddress && result.network.endAddress
      ? result.network.startAddress === result.network.endAddress
        ? result.network.startAddress
        : `${result.network.startAddress} – ${result.network.endAddress}`
      : result.network.startAddress || result.network.endAddress
    : "";
  const endpoint = result ? safeHttpsUrl(result.endpoint) : null;
  const safeLinks =
    result?.links
      .map((link) => ({ ...link, safeHref: safeHttpsUrl(link.href) }))
      .filter((link) => link.safeHref) ?? [];
  const hasNetworkDetails = Boolean(
    result &&
    (range ||
      result.network.cidrs.length ||
      result.network.handle ||
      result.network.name ||
      result.network.type ||
      holder?.name ||
      result.network.ipVersion ||
      result.network.country ||
      result.network.parentHandle ||
      registeredEvent ||
      updatedEvent ||
      otherEvents.length ||
      visibleEntities.length ||
      result.registry ||
      endpoint),
  );
  const textBlocks = result
    ? [
        ...result.remarks.map((block) => ({ kind: "remark" as const, block })),
        ...result.notices.map((block) => ({ kind: "notice" as const, block })),
      ].filter(({ block }) => block.title || block.description.some(Boolean))
    : [];

  return (
    <Workspace active="whois">
      <div className="lookup-page">
        <h1 className="lookup-title">
          {t("WHOIS 与 RDAP 查询", "Whois & RDAP Lookup")}
        </h1>

        <LookupForm
          id="whois-ip"
          value={input}
          onChange={setInput}
          onSubmit={submit}
          isLoading={isLoading}
          label={t("IP 地址", "IP address")}
          placeholder={t("IPv4 / IPv6 地址", "IPv4 / IPv6 address")}
        />

        {isLoading && (
          <StatusNotice>
            {result
              ? t(
                  "正在查询新地址，当前仍显示上次查询结果。",
                  "Looking up the new address. The previous result remains visible.",
                )
              : t("正在联系注册局…", "Contacting the registry…")}
          </StatusNotice>
        )}

        {failure && (
          <StatusNotice tone="error">
            <span>{failureMessage}</span>{" "}
            {failure.kind !== "VALIDATION" && (
              <button className="notice-action" type="button" onClick={retry}>
                {t("重试", "Retry")}
              </button>
            )}
          </StatusNotice>
        )}

        {failure && result && (
          <StatusNotice tone="warning">
            {t(
              `以下是 ${result.ip} 的上次查询结果。`,
              `Showing the previous result for ${result.ip}.`,
            )}
          </StatusNotice>
        )}

        {result && hasNetworkDetails && (
          <DataPanel
            title={result.ip}
            actions={
              <>
                <a href={`/geoip/${encodeURIComponent(result.ip)}`}><span className="desktop-geolocation-label">{t("IP 地理位置", "IP Geolocation")}</span><span className="mobile-geolocation-label">GeoIP</span></a>
                <span className="registry-badge">RDAP</span>
                <CopyButton
                  value={result.ip}
                  label={t("复制 IP", "Copy IP")}
                  compact
                />
              </>
            }
          >
            {range && (
              <DataRow
                label={t("IP 范围", "IP Range")}
                value={range}
                copyValue={range}
                mono
              />
            )}
            {result.network.cidrs.length > 0 && (
              <DataRow
                label="CIDR"
                value={joinNonEmpty(result.network.cidrs)}
                copyValue={joinNonEmpty(result.network.cidrs)}
                mono
              />
            )}
            {result.network.handle && (
              <DataRow
                label={t("标识", "Handle")}
                value={result.network.handle}
                copyValue={result.network.handle}
                mono
              />
            )}
            {result.network.name && (
              <DataRow
                label={t("名称", "Name")}
                value={result.network.name}
                mono
              />
            )}
            {result.network.type && (
              <DataRow label={t("类型", "Type")} value={result.network.type} />
            )}
            {holder?.name && (
              <DataRow label={t("持有者", "Holder")} value={holder.name} />
            )}
            {result.network.ipVersion && (
              <DataRow
                label={t("IP 版本", "IP version")}
                value={result.network.ipVersion}
                mono
              />
            )}
            {result.network.country && (
              <DataRow
                label={t("国家或地区", "Country")}
                value={<CountryLabel code={result.network.country}>{result.network.country}</CountryLabel>}
                copyValue={result.network.country}
              />
            )}
            {result.network.parentHandle && (
              <DataRow
                label={t("上级标识", "Parent handle")}
                value={result.network.parentHandle}
                mono
              />
            )}
            {registeredEvent && (
              <DataRow
                label={t("注册时间", "Registered")}
                value={formatDate(registeredEvent.date)}
                mono
              />
            )}
            {updatedEvent && (
              <DataRow
                label={t("更新时间", "Updated")}
                value={formatDate(updatedEvent.date)}
                mono
              />
            )}
            {otherEvents.map((event, index) => (
              <DataRow
                key={`${event.action}-${event.date}-${index}`}
                label={event.action || t("事件", "Event")}
                value={formatDate(event.date)}
                mono
              />
            ))}
            {visibleEntities.map((entity, index) => {
              const roles = entity.roles.map((role) => roleLabel(role, t));
              const identity = entity.name || entity.handle;
              return (
                <Fragment key={`${entity.handle}-${index}`}>
                  {identity && (
                    <DataRow
                      label={
                        roles.length
                          ? roles.join(" / ")
                          : t("联系人", "Contact")
                      }
                      value={<EntityIdentity entity={entity} />}
                    />
                  )}
                  {entity.emails.length > 0 && (
                    <DataRow
                      label={t("邮箱", "Email")}
                      value={joinNonEmpty(entity.emails)}
                      copyValue={joinNonEmpty(entity.emails)}
                      mono
                    />
                  )}
                  {entity.phones.length > 0 && (
                    <DataRow
                      label={t("电话", "Phone")}
                      value={joinNonEmpty(entity.phones)}
                      copyValue={joinNonEmpty(entity.phones)}
                      mono
                    />
                  )}
                  {entity.address && (
                    <DataRow
                      label={t("地址", "Address")}
                      value={displayAddress(entity.address)}
                      copyValue={entity.address}
                    />
                  )}
                </Fragment>
              );
            })}
            {result.registry && (
              <DataRow
                label={t("注册局", "Registry")}
                value={result.registry}
              />
            )}
            {endpoint && (
              <DataRow
                label={t("RDAP 端点", "RDAP endpoint")}
                value={
                  <a href={endpoint} target="_blank" rel="noreferrer">
                    {endpoint}
                  </a>
                }
                copyValue={endpoint}
                mono
              />
            )}
          </DataPanel>
        )}

        {result && (textBlocks.length > 0 || safeLinks.length > 0) && (
          <DataPanel title={t("注册局说明", "Registry notes")}>
            {textBlocks.map(({ kind, block }, index) => (
              <DataRow
                key={`${kind}-${block.title}-${index}`}
                label={
                  block.title ||
                  (kind === "remark"
                    ? t("备注", "Remark")
                    : t("通知", "Notice"))
                }
                value={<DescriptionBlock block={block} />}
              />
            ))}
            {safeLinks.map((link, index) => (
              <DataRow
                key={`${link.href}-${index}`}
                label={link.title || t("相关链接", "Related link")}
                value={
                  <a href={link.safeHref!} target="_blank" rel="noreferrer">
                    {link.safeHref}
                  </a>
                }
                mono
              />
            ))}
          </DataPanel>
        )}

        {result && (
          <details className="source-details">
            <summary>{t("原始 RDAP JSON", "Raw RDAP JSON")}</summary>
            <div className="result-actions">
              <CopyButton
                value={JSON.stringify(result.raw, null, 2)}
                label={t("复制 JSON", "Copy JSON")}
              />
            </div>
            <pre className="raw-json">
              {JSON.stringify(result.raw, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </Workspace>
  );
}
