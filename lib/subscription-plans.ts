export const SUBSCRIPTION_PLANS = [
  { value: "prova", label: "Prova (7 giorni)", durationDays: 7 },
  { value: "mensile", label: "Mensile (30 giorni)", durationDays: 30 },
  { value: "bimensile", label: "Bimensile (60 giorni)", durationDays: 60 },
  { value: "trimensile", label: "Trimensile (90 giorni)", durationDays: 90 },
  { value: "semestrale", label: "Semestrale (180 giorni)", durationDays: 180 },
  { value: "annuale", label: "Annuale (365 giorni)", durationDays: 365 }
] as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number]["value"];

export const PLAN_DURATIONS: Record<SubscriptionPlan, number> = SUBSCRIPTION_PLANS.reduce(
  (acc, item) => {
    acc[item.value] = item.durationDays;
    return acc;
  },
  {} as Record<SubscriptionPlan, number>
);
