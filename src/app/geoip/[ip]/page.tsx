import { GeoLookup } from "@/components/geo-lookup";

export default function GeoIpResultPage({
  params,
  searchParams,
}: {
  params: { ip: string };
  searchParams?: { external?: string };
}) {
  return (
    <GeoLookup
      initialIp={params.ip}
      initialExternal={searchParams?.external !== "false"}
    />
  );
}
