const ACTIVE_STATUSES = new Set(["active", "trialing"]);

function parseGraceDays(): number {
  const raw = process.env.SUBSCRIPTION_GRACE_DAYS;
  const value = Number(raw ?? "0");
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

export function isSubscriptionOperational(params: {
  status: string;
  currentPeriodEnd: string | null;
  now?: Date;
}): boolean {
  if (!ACTIVE_STATUSES.has(params.status)) {
    return false;
  }

  if (!params.currentPeriodEnd) {
    return true;
  }

  const end = new Date(params.currentPeriodEnd);
  if (Number.isNaN(end.getTime())) {
    return false;
  }

  const now = params.now ?? new Date();
  const graceDays = parseGraceDays();
  const graceMillis = graceDays * 24 * 60 * 60 * 1000;
  return end.getTime() + graceMillis >= now.getTime();
}
