import type { Metadata } from "next";
import { AuthPanel } from "@/components/account/auth-panel";

export const metadata: Metadata = {
  title: "Accedi | PitchBrain"
};

export default function LoginPage({
  searchParams
}: {
  searchParams: { next?: string; error?: string; mode?: string };
}) {
  const initialMode = searchParams.mode === "register" ? "register" : "login";

  return (
    <AuthPanel
      initialMode={initialMode}
      nextPath={searchParams.next ?? "/"}
      error={searchParams.error}
    />
  );
}
