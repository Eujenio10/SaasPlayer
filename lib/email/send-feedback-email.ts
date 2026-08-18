import { Resend } from "resend";
import { env } from "@/lib/env";

export const SUPPORT_INBOX_EMAIL = "support@pitchbrain.it";

function resendClient(): Resend | null {
  const apiKey = env.RESEND_API_KEY.trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type SendFeedbackEmailResult =
  | { ok: true }
  | { ok: false; error: "email_not_configured" | "send_failed"; message: string };

export async function sendFeedbackEmail(params: {
  message: string;
  contactEmail: string | null;
  userId: string | null;
  role: string;
}): Promise<SendFeedbackEmailResult> {
  const client = resendClient();
  if (!client) {
    return {
      ok: false,
      error: "email_not_configured",
      message: "Invio email non configurato sul server. Riprova più tardi."
    };
  }

  const contact = params.contactEmail?.trim() || "non indicato";
  const html = `<!DOCTYPE html>
<html lang="it">
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;background:#f8fafc;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0891b2">PitchBrain</p>
    <h1 style="margin:0 0 16px;font-size:20px;color:#0e7490">Nuovo feedback dall'app</h1>
    <p style="margin:0 0 8px;color:#475569"><strong>Contatto:</strong> ${escapeHtml(contact)}</p>
    <p style="margin:0 0 8px;color:#475569"><strong>Account:</strong> ${escapeHtml(params.role)}${
      params.userId ? ` · ${escapeHtml(params.userId)}` : " · guest"
    }</p>
    <p style="margin:16px 0 8px;color:#0f172a;white-space:pre-wrap">${escapeHtml(params.message)}</p>
  </div>
</body>
</html>`;

  const { error } = await client.emails.send({
    from: env.AUTH_EMAIL_FROM,
    to: SUPPORT_INBOX_EMAIL,
    replyTo: params.contactEmail || undefined,
    subject: "PitchBrain — feedback dall'app",
    html
  });

  if (error) {
    console.error("[feedback-email] resend_failed", { message: error.message });
    return {
      ok: false,
      error: "send_failed",
      message: "Non siamo riusciti a inviare il messaggio. Riprova tra qualche minuto."
    };
  }

  return { ok: true };
}
