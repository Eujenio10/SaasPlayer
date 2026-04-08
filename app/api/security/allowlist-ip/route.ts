import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";

function firstIpFromForwardedFor(value: string): string | null {
  const parts = value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts[0] ?? null;
}

function normalizeIp(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("::ffff:")) return trimmed.replace("::ffff:", "");
  if (trimmed === "::1") return "127.0.0.1";
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
  return /^[0-9a-f:]+$/i.test(ip) && ip.includes(":");
}

function isValidIp(ip: string): boolean {
  return isValidIpv4(ip) || isValidIpv6(ip);
}

function getClientIpFromRequest(request: Request): string | null {
  const trustProxy = process.env.IP_TRUST_PROXY === "true";
  const realIp = request.headers.get("x-real-ip");
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (trustProxy && forwardedFor) {
    const first = firstIpFromForwardedFor(forwardedFor);
    if (first) {
      const normalized = normalizeIp(first);
      if (isValidIp(normalized)) return normalized;
    }
  }

  if (trustProxy && realIp) {
    const normalized = normalizeIp(realIp);
    if (isValidIp(normalized)) return normalized;
  }

  if (forwardedFor) {
    const first = firstIpFromForwardedFor(forwardedFor);
    if (first) {
      const normalized = normalizeIp(first);
      if (isValidIp(normalized)) return normalized;
    }
  }

  if (realIp) {
    const normalized = normalizeIp(realIp);
    if (isValidIp(normalized)) return normalized;
  }

  return null;
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const organization = await getOrganizationContextForUser(user.id);
  if (!organization) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (organization.role !== "admin") {
    return NextResponse.json({ error: "forbidden_role" }, { status: 403 });
  }

  const clientIp = getClientIpFromRequest(request);
  if (!clientIp) {
    return NextResponse.json({ error: "ip_unavailable" }, { status: 400 });
  }

  // For safety, allowlist a single address (ipv4 /32, ipv6 /128).
  const cidr = isValidIpv6(clientIp) ? `${clientIp}/128` : `${clientIp}/32`;

  const service = createSupabaseServiceClient();
  const { data: orgRow, error: orgErr } = await service
    .from("organizations")
    .select("allowed_ip, allowed_ip_ranges")
    .eq("id", organization.organizationId)
    .maybeSingle<{ allowed_ip: string; allowed_ip_ranges: string[] }>();

  if (orgErr || !orgRow) {
    return NextResponse.json({ error: "organization_unavailable" }, { status: 503 });
  }

  const existingRanges = Array.isArray(orgRow.allowed_ip_ranges) ? orgRow.allowed_ip_ranges : [];
  const merged = Array.from(new Set([...existingRanges, cidr]));

  const legacyAllowedIp = (orgRow.allowed_ip ?? "").trim();
  const nextLegacyAllowedIp = legacyAllowedIp || cidr;

  const { error: updateErr } = await service
    .from("organizations")
    .update({
      allowed_ip: nextLegacyAllowedIp,
      allowed_ip_ranges: merged
    })
    .eq("id", organization.organizationId);

  if (updateErr) {
    return NextResponse.json({ error: "update_failed" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, clientIp, cidr });
}

