import type { NextRequest } from "next/server";

interface ClientIpOptions {
  trustProxy: boolean;
  trustedProxyHops: number;
}

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.startsWith("::ffff:")) {
    return trimmed.replace("::ffff:", "");
  }
  if (trimmed === "::1") {
    return "127.0.0.1";
  }
  return trimmed;
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
  // Minimal validation for middleware safety checks.
  return /^[0-9a-f:]+$/i.test(ip) && ip.includes(":");
}

function isValidIp(ip: string): boolean {
  return isValidIpv4(ip) || isValidIpv6(ip);
}

function firstValidIpFromList(values: string[]): string | null {
  for (const value of values) {
    const normalized = normalizeIp(value);
    if (isValidIp(normalized)) return normalized;
  }
  return null;
}

function extractFromForwardedFor(
  forwardedFor: string,
  trustedProxyHops: number
): string | null {
  const ips = forwardedFor
    .split(",")
    .map((part) => normalizeIp(part))
    .filter((part) => isValidIp(part));

  if (!ips.length) return null;

  // Prefer the nearest untrusted hop from the right.
  const index = Math.max(0, ips.length - (trustedProxyHops + 1));
  return ips[index] ?? null;
}

export function getClientIp(
  request: NextRequest,
  options: ClientIpOptions
): string | null {
  const realIp = request.headers.get("x-real-ip");
  if (options.trustProxy && realIp) {
    const normalized = normalizeIp(realIp);
    if (isValidIp(normalized)) return normalized;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (options.trustProxy && forwardedFor) {
    return extractFromForwardedFor(
      forwardedFor,
      Math.max(0, options.trustedProxyHops)
    );
  }

  if (forwardedFor) {
    return firstValidIpFromList(forwardedFor.split(","));
  }

  if (realIp) {
    const normalized = normalizeIp(realIp);
    if (isValidIp(normalized)) return normalized;
  }

  return null;
}
