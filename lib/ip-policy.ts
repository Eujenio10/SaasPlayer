function ipToInt(ip: string): number {
  return ip
    .split(".")
    .map((octet) => Number(octet))
    .reduce((acc, octet) => (acc << 8) + octet, 0) >>> 0;
}

function isValidIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const value = Number(part);
    return value >= 0 && value <= 255;
  });
}

function isValidIpv6(ip: string): boolean {
  return /^[0-9a-f:]+$/i.test(ip) && ip.includes(":");
}

function isValidIp(ip: string): boolean {
  return isValidIpv4(ip) || isValidIpv6(ip);
}

function isIpv4InCidr(ip: string, cidr: string): boolean {
  const [network, prefixRaw] = cidr.split("/");
  const prefix = Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  if (!isValidIpv4(network) || !isValidIpv4(ip)) return false;

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(network) & mask);
}

function tokenMatches(ip: string, token: string): boolean {
  const value = token.trim();
  if (!value) return false;

  if (value.includes("/")) {
    return isIpv4InCidr(ip, value);
  }

  return value === ip;
}

function tokenize(...sources: Array<string | null | undefined>): string[] {
  return sources
    .flatMap((source) => (source ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isIpAllowed(params: {
  clientIp: string;
  legacyAllowedIp: string | null | undefined;
  allowedRanges?: string[] | null;
}): boolean {
  if (!isValidIp(params.clientIp)) return false;

  const rules = [
    ...tokenize(params.legacyAllowedIp),
    ...(params.allowedRanges ?? []).flatMap((item) => tokenize(item))
  ];

  if (!rules.length) return false;
  return rules.some((rule) => tokenMatches(params.clientIp, rule));
}
