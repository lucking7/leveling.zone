"use client";

import Link from "next/link";
import type { SourceResult } from "@/modules/query/types";
import { CountryLabel } from "./country-flag";
import { useLocale } from "./locale";
import { CopyButton, DataPanel, DataRow } from "./workspace";
import { text, coordinates, locationSummary } from "./source-model";

export function SourcePanels({ ip, source, visitor = false }: {
  ip: string; source: SourceResult; visitor?: boolean;
}) {
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
        title={visitor ? t("当前 IP", "Your IP") : ip}
        actions={
          <>
            {!visitor && <>
              <Link href={`/whois/${encodeURIComponent(ip)}`}>Whois</Link>
              <span className="ip-version">{version}</span>
            </>}
            <CopyButton value={ip} label={t("复制 IP", "Copy IP")} compact />
          </>
        }
      >
        <DataRow mono label={t("地址", "Address")} value={ip} copyValue={ip} />
        {visitor && <DataRow mono label={t("地址版本", "IP version")} value={version} />}
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
