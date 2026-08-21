import { z } from "zod";
import { infrai, type SmsSendResult } from "./infrai_sms_client.ts";

export const orderEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("checkout_completed"), orderId: z.string().min(1), phone: z.string().regex(/^\+[1-9]\d{7,14}$/), total: z.string().min(1) }),
  z.object({ kind: z.literal("fulfillment_shipped"), orderId: z.string().min(1), phone: z.string().regex(/^\+[1-9]\d{7,14}$/), trackingCode: z.string().min(1) }),
  z.object({ kind: z.literal("receipt_ready"), orderId: z.string().min(1), phone: z.string().regex(/^\+[1-9]\d{7,14}$/), receiptNumber: z.string().min(1) }),
  z.object({ kind: z.literal("customer_update"), orderId: z.string().min(1), phone: z.string().regex(/^\+[1-9]\d{7,14}$/), update: z.string().min(1).max(120) }),
  z.object({ kind: z.literal("checkout_abandoned"), orderId: z.string().min(1), phone: z.string().regex(/^\+[1-9]\d{7,14}$/) })
]);

export type OrderEvent = z.infer<typeof orderEventSchema>;
type SendSms = (payload: { to: string; body: string }, idempotencyKey: string) => Promise<SmsSendResult>;

export function buildOrderAlert(event: OrderEvent): string | null {
  switch (event.kind) {
    case "checkout_completed":
      return `Order ${event.orderId} is confirmed. Total: ${event.total}.`;
    case "fulfillment_shipped":
      return `Order ${event.orderId} shipped. Tracking: ${event.trackingCode}.`;
    case "receipt_ready":
      return `Receipt ${event.receiptNumber} is ready for order ${event.orderId}.`;
    case "customer_update":
      return `Order ${event.orderId}: ${event.update}`;
    case "checkout_abandoned":
      return null;
  }
}

export async function notifyCustomer(event: OrderEvent, sendSms: SendSms = infrai.sms.send) {
  const message = buildOrderAlert(event);
  if (message === null) return { sent: false as const, reason: "non-transactional-event" as const };

  const result = await sendSms(
    { to: event.phone, body: message },
    `order:${event.orderId}:${event.kind}`
  );
  return { sent: true as const, messageId: result.message_id };
}
