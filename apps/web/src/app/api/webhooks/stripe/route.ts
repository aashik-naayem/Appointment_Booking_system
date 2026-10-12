import { type NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/integrations/stripe";
import { inngest } from "@/lib/jobs/inngest";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.arrayBuffer();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event;
  try {
    event = constructWebhookEvent(Buffer.from(body), signature);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Process webhook asynchronously via Inngest (ensures idempotency and retries)
  try {
    await inngest.send({
      name: "stripe/webhook",
      data: {
        eventId: event.id,
        type: event.type,
        payload: event.data.object as unknown as Record<string, unknown>,
      },
    });
  } catch (err) {
    console.error("Failed to queue Stripe webhook:", err);
    return NextResponse.json({ error: "Failed to queue event" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
