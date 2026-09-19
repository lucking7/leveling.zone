export type IpFamily = "ipv4" | "ipv6";

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    if (part.length > 1 && part.startsWith("0")) return false;
    const number = Number(part);
    return number >= 0 && number <= 255;
  });
}

function ipv6PartCount(parts: string[]): number | null {
  let count = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part) return null;
    if (part.includes(".")) {
      if (index !== parts.length - 1 || !isIpv4(part)) return null;
      count += 2;
    } else {
      if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
      count += 1;
    }
  }
  return count;
}

function isIpv6(value: string): boolean {
  if (!value.includes(":")) return false;
  const halves = value.split("::");
  if (halves.length > 2) return false;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 2 && left.some((part) => part.includes("."))) return false;
  const leftCount = ipv6PartCount(left);
  const rightCount = ipv6PartCount(right);
  if (leftCount === null || rightCount === null) return false;
  const count = leftCount + rightCount;
  return halves.length === 2 ? count < 8 : count === 8;
}

export function ipFamily(value: string): IpFamily | null {
  if (isIpv4(value)) return "ipv4";
  if (isIpv6(value)) return "ipv6";
  return null;
}
