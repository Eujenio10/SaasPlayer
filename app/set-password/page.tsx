import type { Metadata } from "next";
import { SetPasswordClient } from "./set-password-client";

export const metadata: Metadata = {
  title: "Imposta password | PitchBrain"
};

export const dynamic = "force-dynamic";

export default function SetPasswordPage() {
  return <SetPasswordClient />;
}
