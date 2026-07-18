export const PRO_PLAN_PRICING = {
  monthlyPrice: 6.99,
  originalPrice: 9.99,
  discountPercent: 30,
  currency: "€"
} as const;

export function formatProPrice(value: number): string {
  return `${PRO_PLAN_PRICING.currency}${value.toFixed(2).replace(".", ",")}`;
}
