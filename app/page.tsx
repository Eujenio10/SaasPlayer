import { redirect } from "next/navigation";
import { DashboardHomePage } from "@/components/dashboard-home-page";
import { getSessionContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Supabase invita spesso con redirect a Site URL: `/?code=...` (PKCE).
 * Senza questo passaggio, la home manderebbe subito a /login e l'invito non verrebbe mai completato.
 */
function buildAuthConfirmFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): string | null {
  const get = (key: string): string | undefined => {
    const v = searchParams[key];
    if (typeof v === "string") return v;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
    return undefined;
  };

  const code = get("code");
  const tokenHash = get("token_hash") ?? get("token");
  const type = get("type");

  if (code) {
    const qs = new URLSearchParams();
    qs.set("code", code);
    qs.set("next", "/set-password");
    return `/auth/confirm?${qs.toString()}`;
  }

  if (tokenHash && type) {
    const qs = new URLSearchParams();
    qs.set("token_hash", tokenHash);
    qs.set("type", type);
    qs.set("next", "/set-password");
    return `/auth/confirm?${qs.toString()}`;
  }

  return null;
}

export default async function HomePage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const inviteContinue = buildAuthConfirmFromSearchParams(searchParams);
  if (inviteContinue) {
    redirect(inviteContinue);
  }

  const session = await getSessionContext();
  if (!session) {
    redirect("/login");
  }
  if (!session.organization) {
    redirect("/forbidden");
  }

  return <DashboardHomePage email={session.email} />;
}
