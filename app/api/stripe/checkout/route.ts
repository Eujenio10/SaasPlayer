import { NextResponse } from "next/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  organizationName: z.string().min(2),
  priceId: z.string().min(1)
});

export async function POST(request: Request) {
  const json = await request.json();
  const body = bodySchema.parse(json);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: body.priceId, quantity: 1 }],
    success_url: `${env.NEXT_PUBLIC_APP_URL}/?checkout=success`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/?checkout=cancel`,
    metadata: {
      organizationId: body.organizationId,
      organizationName: body.organizationName
    }
  });

  return NextResponse.json({ url: session.url }, { status: 201 });
}
