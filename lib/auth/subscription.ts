import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isSubscriptionOperational } from "@/lib/subscription-policy";

export interface SubscriptionContext {
  status: string;
  currentPeriodEnd: string | null;
  isOperational: boolean;
}

export async function getSubscriptionContextForOrganization(
  organizationId: string
): Promise<SubscriptionContext | null> {
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const currentPeriodEnd = data.current_period_end
    ? new Date(data.current_period_end).toISOString()
    : null;

  return {
    status: data.status,
    currentPeriodEnd,
    isOperational: isSubscriptionOperational({
      status: data.status,
      currentPeriodEnd
    })
  };
}
