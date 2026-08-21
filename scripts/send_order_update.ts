import { notifyCustomer, orderEventSchema } from "../src/order_alert_service.ts";

const phone = process.env.DEMO_PHONE;
if (!phone) throw new Error("DEMO_PHONE is required");

const event = orderEventSchema.parse({
  kind: "fulfillment_shipped",
  orderId: "SHOP-1042",
  phone,
  trackingCode: "PKG-88421"
});

const result = await notifyCustomer(event);
console.log("Fulfillment alert result:", result);
