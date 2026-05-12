import { NextResponse, type NextRequest } from "next/server";
import { getClientIp } from "@/lib/ip";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

const protectedPrefixes = [
  "/display",
  "/kiosk",
  "/kiosk-testing",
  "/profilo",
  "/admin",
  "/api/admin"
];

function isProtectedPath(pathname: string): boolean {
  return protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isAdminOnlyPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/kiosk-testing")
  );
}

function buildApiUrl(path: string): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  return `${supabaseUrl}${path}`;
}

function serviceHeaders(): HeadersInit | null {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) return null;
  return {
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
    "Content-Type": "application/json"
  };
}

interface MembershipRow {
  organization_id: string;
  role: "admin" | "pro" | "member" | "viewer";
  organizations:
    | { name: string; allowed_ip: string; allowed_ip_ranges: string[] | null }
    | Array<{ name: string; allowed_ip: string; allowed_ip_ranges: string[] | null }>;
}

async function getMembership(userId: string): Promise<MembershipRow | null> {
  const headers = serviceHeaders();
  const url = buildApiUrl(
    `/rest/v1/organization_users?user_id=eq.${encodeURIComponent(
      userId
    )}&select=organization_id,role,organizations(name,allowed_ip,allowed_ip_ranges)&limit=1`
  );

  if (!headers || !url) return null;
  const response = await fetch(url, {
    headers,
    cache: "no-store"
  });
  if (!response.ok) return null;

  const rows = (await response.json()) as MembershipRow[];
  if (!rows.length) return null;
  return rows[0];
}

async function writeAuditLog(params: {
  userId: string | null;
  organizationId: string | null;
  ip: string | null;
  xForwardedFor: string | null;
  userAgent: string | null;
  path: string;
  reason: string;
  result: "allowed" | "forbidden" | "redirect_login";
}) {
  const headers = serviceHeaders();
  const url = buildApiUrl("/rest/v1/access_audit_logs");
  if (!headers || !url) return;

  await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user_id: params.userId,
      organization_id: params.organizationId,
      ip: params.ip,
      x_forwarded_for: params.xForwardedFor,
      user_agent: params.userAgent,
      path: params.path,
      reason: params.reason,
      result: params.result
    }),
    cache: "no-store"
  });
}

function normalizeAccessRole(role: MembershipRow["role"]): "admin" | "pro" | "member" {
  if (role === "admin" || role === "pro" || role === "member") return role;
  return "member";
}

export async function middleware(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const trustProxy = process.env.IP_TRUST_PROXY === "true";
  const trustedProxyHops = Number(process.env.IP_TRUSTED_PROXY_HOPS ?? "0");
  const clientIp = getClientIp(request, { trustProxy, trustedProxyHops });
  const forwardedFor = request.headers.get("x-forwarded-for");
  const userAgent = request.headers.get("user-agent");

  const response = NextResponse.next();
  const supabase = createSupabaseMiddlewareClient(request, response);
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    await writeAuditLog({
      userId: null,
      organizationId: null,
      ip: clientIp,
      xForwardedFor: forwardedFor,
      userAgent,
      path: request.nextUrl.pathname,
      reason: "missing_session",
      result: "redirect_login"
    });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const membership = await getMembership(user.id);
  const organization = membership?.organizations;
  const organizationData = Array.isArray(organization)
    ? organization[0]
    : organization;
  const organizationId = membership?.organization_id ?? null;
  const role = membership ? normalizeAccessRole(membership.role) : null;

  if (!membership || !organizationData?.name) {
    await writeAuditLog({
      userId: user.id,
      organizationId,
      ip: clientIp,
      xForwardedFor: forwardedFor,
      userAgent,
      path: request.nextUrl.pathname,
      reason: "missing_membership",
      result: "forbidden"
    });
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  if (isAdminOnlyPath(request.nextUrl.pathname) && role !== "admin") {
    await writeAuditLog({
      userId: user.id,
      organizationId,
      ip: clientIp,
      xForwardedFor: forwardedFor,
      userAgent,
      path: request.nextUrl.pathname,
      reason: "role_not_allowed",
      result: "forbidden"
    });
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  response.cookies.set("org_id", membership.organization_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  response.cookies.set("org_name", organizationData.name, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  response.cookies.set("access_role", role ?? "member", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  await writeAuditLog({
    userId: user.id,
    organizationId: membership.organization_id,
    ip: clientIp,
    xForwardedFor: forwardedFor,
    userAgent,
    path: request.nextUrl.pathname,
    reason: "access_granted",
    result: "allowed"
  });

  return response;
}

export const config = {
  matcher: [
    "/display/:path*",
    "/kiosk/:path*",
    "/kiosk-testing/:path*",
    "/profilo/:path*",
    "/admin/:path*",
    "/api/admin/:path*"
  ]
};
