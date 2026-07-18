import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { insertRewardedAdReceipt } from "@/lib/entitlements/repository";
import { isValidDeviceId, resolveSubjectKey } from "@/lib/entitlements/subject";

export const dynamic = "force-dynamic";

/**
 * Callback AdMob Server-Side Verification (SSV).
 * Configura in AdMob la URL: https://<host>/api/ads/admob-ssv
 *
 * Query tipiche AdMob: ad_network, ad_unit, reward_amount, reward_item,
 * timestamp, transaction_id, user_id (custom data), signature, key_id
 *
 * In produzione verifica la firma con le chiavi pubbliche Google.
 * Qui: se PITCHBRAIN_ADMOB_SSV_STRICT=1 richiede firma HMAC locale di fallback;
 * altrimenti accetta transaction_id presenti (utile in staging).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const transactionId = url.searchParams.get("transaction_id")?.trim();
  const customData = url.searchParams.get("user_id")?.trim() ?? url.searchParams.get("custom_data")?.trim();
  const matchIdRaw = url.searchParams.get("match_id");
  const matchId = matchIdRaw ? Number(matchIdRaw) : null;

  if (!transactionId) {
    return NextResponse.json({ error: "missing_transaction_id" }, { status: 400 });
  }

  // custom_data atteso: user:<uuid> | device:<id>
  let subjectKey = customData && customData.includes(":") ? customData : null;
  if (!subjectKey && customData && isValidDeviceId(customData)) {
    subjectKey = resolveSubjectKey({ deviceId: customData });
  }
  if (!subjectKey) {
    return NextResponse.json({ error: "missing_subject" }, { status: 400 });
  }

  const strict = process.env.PITCHBRAIN_ADMOB_SSV_STRICT === "1";
  if (strict) {
    const signature = url.searchParams.get("signature")?.trim();
    const secret = process.env.PITCHBRAIN_ADMOB_SSV_SECRET?.trim();
    if (!signature || !secret) {
      return NextResponse.json({ error: "ssv_not_configured" }, { status: 501 });
    }
    // Placeholder: in produzione usare le public keys AdMob SSV.
    const payload = `${transactionId}:${subjectKey}`;
    const expected = createHash("sha256").update(`${secret}:${payload}`).digest("hex");
    if (signature !== expected) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
    }
  }

  const inserted = await insertRewardedAdReceipt({
    transactionId,
    subjectKey,
    matchId: matchId && Number.isFinite(matchId) ? matchId : null
  });

  if (!inserted.ok) {
    return NextResponse.json({ error: inserted.message ?? "persist_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
