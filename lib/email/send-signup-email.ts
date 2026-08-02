import { Resend } from "resend";
import { env } from "@/lib/env";

function resendClient(): Resend | null {
  const apiKey = env.RESEND_API_KEY.trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function signupEmailHtml(actionLink: string, resent: boolean): string {
  const intro = resent
    ? "Hai richiesto un nuovo link per completare la registrazione su PitchBrain."
    : "Benvenuto su PitchBrain. Per attivare il tuo account, apri il link qui sotto e scegli la password.";

  return `<!DOCTYPE html>
<html lang="it">
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;background:#f8fafc;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0891b2">PitchBrain</p>
    <h1 style="margin:0 0 12px;font-size:22px;color:#0e7490">${resent ? "Completa la registrazione" : "Conferma il tuo account"}</h1>
    <p style="margin:0 0 20px;color:#475569">${intro}</p>
    <p style="margin:0 0 24px">
      <a href="${actionLink}" style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:8px">
        Scegli password e accedi
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#64748b">Se il pulsante non funziona, copia e incolla questo link nel browser:<br><span style="word-break:break-all">${actionLink}</span></p>
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">Se non hai richiesto tu questa email, puoi ignorarla.</p>
  </div>
</body>
</html>`;
}

export type SendSignupEmailResult =
  | { ok: true }
  | { ok: false; error: "email_not_configured" | "send_failed"; message: string };

export async function sendSignupEmail(
  to: string,
  actionLink: string,
  resent: boolean
): Promise<SendSignupEmailResult> {
  const client = resendClient();
  if (!client) {
    return {
      ok: false,
      error: "email_not_configured",
      message:
        "Invio email non configurato sul server. Contatta il supporto o riprova più tardi."
    };
  }

  const subject = resent
    ? "PitchBrain — nuovo link per completare la registrazione"
    : "PitchBrain — conferma account e scegli la password";

  const { error } = await client.emails.send({
    from: env.AUTH_EMAIL_FROM,
    to,
    subject,
    html: signupEmailHtml(actionLink, resent)
  });

  if (error) {
    console.error("[signup-email] resend_failed", { to, message: error.message });
    return {
      ok: false,
      error: "send_failed",
      message: "Non siamo riusciti a inviare l'email. Riprova tra qualche minuto."
    };
  }

  return { ok: true };
}
