import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/get-api-user";
import { sendFeedbackEmail } from "@/lib/email/send-feedback-email";
import { isMobileClientRequest } from "@/lib/entitlements/config";
import { NO_STORE_HEADERS } from "@/lib/http/no-store-headers";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().trim().min(10, "too_short").max(2000, "too_long"),
  contactEmail: z.string().trim().optional()
});

const recentSends = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 3;

function clientKey(request: Request): string {
  const deviceId = request.headers.get("x-device-id")?.trim();
  if (deviceId) return `device:${deviceId.slice(0, 80)}`;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${forwarded || "unknown"}`;
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const previous = (recentSends.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (previous.length >= MAX_PER_WINDOW) {
    recentSends.set(key, previous);
    return true;
  }
  previous.push(now);
  recentSends.set(key, previous);
  return false;
}

export async function POST(request: Request) {
  if (!isMobileClientRequest(request)) {
    return NextResponse.json({ error: "mobile_only" }, { status: 403, headers: NO_STORE_HEADERS });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    const message =
      issue === "too_short"
        ? "Scrivi almeno 10 caratteri."
        : issue === "too_long"
          ? "Il messaggio è troppo lungo (massimo 2000 caratteri)."
          : "Controlla il messaggio e, se lo indichi, l'email.";
    return NextResponse.json({ error: "invalid_params", message }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const rawEmail = parsed.data.contactEmail?.trim() ?? "";
  if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return NextResponse.json(
      { error: "invalid_params", message: "Inserisci un'email valida o lasciala vuota." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (isRateLimited(clientKey(request))) {
    return NextResponse.json(
      { error: "rate_limited", message: "Hai già inviato alcuni messaggi. Riprova tra qualche minuto." },
      { status: 429, headers: NO_STORE_HEADERS }
    );
  }

  const user = await getApiUser(request);
  const contactEmail = rawEmail || user?.email?.trim() || null;

  const sent = await sendFeedbackEmail({
    message: parsed.data.message,
    contactEmail,
    userId: user?.id ?? null,
    role: user ? "account" : "guest"
  });

  if (!sent.ok) {
    return NextResponse.json(
      { error: sent.error, message: sent.message },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
