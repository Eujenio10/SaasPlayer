import Stripe from "stripe";
import { env } from "@/lib/env";

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("stripe_not_configured");
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-08-27.basil",
    typescript: true
  });
}
