import { ProfilePage } from "@/components/profile/profile-page";
import { requireProtectedSession } from "@/lib/auth/guards";
import { buildUserAccessSummary } from "@/lib/auth/user-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function memberSinceLabelFrom(createdAt: string | undefined): string {
  if (!createdAt) return "Membro dal —";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "Membro dal —";
  const month = d.toLocaleDateString("it-IT", { month: "long" });
  const capMonth = month.charAt(0).toUpperCase() + month.slice(1);
  return `Membro dal ${d.getDate()} ${capMonth} ${d.getFullYear()}`;
}

function displayNameFromUser(user: {
  user_metadata?: { full_name?: unknown };
  email?: string | null;
}): string {
  const fn = user.user_metadata?.full_name;
  if (typeof fn === "string" && fn.trim().length >= 2) return fn.trim();
  const email = user.email ?? "";
  const local = email.split("@")[0] ?? "Utente";
  const titled = local
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return titled || "Utente";
}

export default async function ProfiloPage() {
  const session = await requireProtectedSession();
  const userAccess = await buildUserAccessSummary(session.userId, session.organization.role);

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const email = session.email ?? user?.email ?? "";
  const initialDisplayName = displayNameFromUser({
    user_metadata: user?.user_metadata as { full_name?: unknown } | undefined,
    email
  });
  const memberSinceLabel = memberSinceLabelFrom(user?.created_at);

  return (
    <ProfilePage
      email={email}
      initialDisplayName={initialDisplayName}
      memberSinceLabel={memberSinceLabel}
      organizationName={session.organization.organizationName}
      userAccess={userAccess}
    />
  );
}
