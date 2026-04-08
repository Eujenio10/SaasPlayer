import { NextResponse, type NextRequest } from "next/server";
import { getClientIp } from "@/lib/ip";
import { isIpAllowed } from "@/lib/ip-policy";
import { isSubscriptionOperational } from "@/lib/subscription-policy";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

const protectedPrefixes = ["/display", "/kiosk", "/kiosk-testing", "/admin", "/api/admin"];
const mobileUserAgentPattern =
  /android|iphone|ipad|ipod|mobile|blackberry|opera mini|iemobile|windows phone/i;

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

function isViewerAllowedPath(pathname: string): boolean {
  if (pathname.startsWith("/display")) return true;
  if (pathname === "/kiosk/hybrid" || pathname.startsWith("/kiosk/hybrid/")) return true;
  return false;
}

function isMobileUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return mobileUserAgentPattern.test(userAgent);
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
  role: "admin" | "viewer";
  organizations:
    | { name: string; allowed_ip: string; allowed_ip_ranges: string[] | null }
    | Array<{ name: string; allowed_ip: string; allowed_ip_ranges: string[] | null }>;
}

interface SubscriptionRow {
  status: string;
  current_period_end: string | null;
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

async function getLatestSubscription(
  organizationId: string
): Promise<SubscriptionRow | null> {
  const headers = serviceHeaders();
  const url = buildApiUrl(
    `/rest/v1/subscriptions?organization_id=eq.${encodeURIComponent(
      organizationId
    )}&select=status,current_period_end&order=created_at.desc&limit=1`
  );

  if (!headers || !url) return null;
  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) return null;

  const rows = (await response.json()) as SubscriptionRow[];
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

export async function middleware(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const trustProxy = process.env.IP_TRUST_PROXY === "true";
  const trustedProxyHops = Number(process.env.IP_TRUSTED_PROXY_HOPS ?? "0");
  const clientIp = getClientIp(request, { trustProxy, trustedProxyHops });
  const forwardedFor = request.headers.get("x-forwarded-for");
  const userAgent = request.headers.get("user-agent");

  if (isMobileUserAgent(userAgent)) {
    await writeAuditLog({
      userId: null,
      organizationId: null,
      ip: clientIp,
      xForwardedFor: forwardedFor,
      userAgent,
      path: request.nextUrl.pathname,
      reason: "mobile_user_agent_blocked",
      result: "forbidden"
    });
    return NextResponse.redirect(new URL("/desktop-only", request.url));
  }

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

  if (!membership || !clientIp || !organizationData?.allowed_ip) {
    await writeAuditLog({
      userId: user.id,
      organizationId,
      ip: clientIp,
      xForwardedFor: forwardedFor,
      userAgent,
      path: request.nextUrl.pathname,
      reason: "missing_membership_or_ip",
      result: "forbidden"
    });
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const allowed = isIpAllowed({
    clientIp,
    legacyAllowedIp: organizationData.allowed_ip,
    allowedRanges: organizationData.allowed_ip_ranges
  });
  if (!allowed) {
    await writeAuditLog({
      userId: user.id,
      organizationId,
      ip: clientIp,
      xForwardedFor: forwardedFor,
      userAgent,
      path: request.nextUrl.pathname,
      reason: "ip_not_allowed",
      result: "forbidden"
    });
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const subscription = await getLatestSubscription(membership.organization_id);
  const isSubscriptionActive =
    subscription &&
    isSubscriptionOperational({
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end
    });

  if (membership.role === "viewer" && !isViewerAllowedPath(request.nextUrl.pathname)) {
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

  if (isAdminOnlyPath(request.nextUrl.pathname) && membership.role !== "admin") {
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

  if (!isSubscriptionActive && membership.role !== "admin") {
    await writeAuditLog({
      userId: user.id,
      organizationId,
      ip: clientIp,
      xForwardedFor: forwardedFor,
      userAgent,
      path: request.nextUrl.pathname,
      reason: "subscription_inactive",
      result: "forbidden"
    });
    return NextResponse.redirect(new URL("/suspended", request.url));
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

  await writeAuditLog({
    userId: user.id,
    organizationId: membership.organization_id,
    ip: clientIp,
    xForwardedFor: forwardedFor,
    userAgent,
    path: request.nextUrl.pathname,
    reason:
      !isSubscriptionActive && membership.role === "admin"
        ? "access_granted_admin_subscription_bypass"
        : "access_granted",
    result: "allowed"
  });

  return response;
}

export const config = {
  matcher: [
    "/display/:path*",
    "/kiosk/:path*",
    "/kiosk-testing/:path*",
    "/admin/:path*",
    "/api/admin/:path*"
  ]
};
