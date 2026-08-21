import assert from "node:assert/strict";
import test from "node:test";
import { notifyCustomer, type OrderEvent } from "../src/order_alert_service.ts";

test("sends the shipped message with a stable order-event key", async () => {
  const calls: Array<{ payload: { to: string; body: string }; key: string }> = [];
  const event: OrderEvent = {
    kind: "fulfillment_shipped",
    orderId: "SHOP-1042",
    phone: "+14155550123",
    trackingCode: "PKG-88421"
  };

  const result = await notifyCustomer(event, async (payload, key) => {
    calls.push({ payload, key });
    return { message_id: "msg_1042" };
  });

  assert.deepEqual(result, { sent: true, messageId: "msg_1042" });
  assert.deepEqual(calls, [{
    payload: { to: "+14155550123", body: "Order SHOP-1042 shipped. Tracking: PKG-88421." },
    key: "order:SHOP-1042:fulfillment_shipped"
  }]);
});

test("does not send an alert for an abandoned checkout", async () => {
  let sends = 0;
  const result = await notifyCustomer({
    kind: "checkout_abandoned",
    orderId: "SHOP-1043",
    phone: "+14155550123"
  }, async () => {
    sends += 1;
    return { message_id: "unexpected" };
  });

  assert.deepEqual(result, { sent: false, reason: "non-transactional-event" });
  assert.equal(sends, 0);
});
