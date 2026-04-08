import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import { LegalFooter } from "@/components/legal-footer";
import { SecurityRuntimeGuard } from "@/components/security-runtime-guard";
import { WatermarkOverlay } from "@/components/watermark-overlay";
import { getSessionContext } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Tactical Intelligence Hub",
  description: "Piattaforma editoriale B2B per analisi tattica calcistica in tempo reale."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111827"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionContext();
  const organizationName = session?.organization?.organizationName ?? "Agency Monitor";
  const organizationId = session?.organization?.organizationId ?? null;
  const sessionTag = session?.userId.slice(-8).toUpperCase() ?? "PUBLIC";
  const watermarkContent = `${organizationName} | SESSIONE ${sessionTag}`;

  return (
    <html lang="it">
      <body
        className="bg-darkGray pb-16 text-slate-100 antialiased"
        data-watermark-content={watermarkContent}
      >
        <WatermarkOverlay organizationName={organizationName} sessionTag={sessionTag} />
        <SecurityRuntimeGuard organizationId={organizationId} />
        <main className="mx-auto min-h-screen w-full min-w-0 max-w-screen-2xl px-3 py-4 sm:px-4 sm:py-6">
          {children}
        </main>
        <LegalFooter />
      </body>
    </html>
  );
}
