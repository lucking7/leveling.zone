import { WhoisLookup } from "@/components/whois-lookup";

export default function WhoisAddressPage({
  params,
}: {
  params: { ip: string };
}) {
  let ip = params.ip;
  try { ip = decodeURIComponent(ip); } catch { /* Invalid escapes remain invalid input. */ }
  return <WhoisLookup initialIp={ip} />;
}
