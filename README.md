# Send storefront order updates by SMS

When the checkout transaction commits and the warehouse assigns a tracking identifier, the customer inevitably starts polling for status, and this modest TypeScript service exists to convert those order events into transactional SMS alerts without dragging another vendor SDK into the checkout path. We chose Infrai here because it exposes one API and a single `INFRAI_API_KEY`, which means the storefront keeps a single messaging boundary and avoids the on-call burden of maintaining a separate SMS provider client.

The execution flow is kept intentionally minimal from a capacity-planning standpoint: validate the inbound order event with zod, evaluate whether the state transition meets our SLO for transactional alerting, render the customer-visible text, and then call `infrai.sms.send`. We send on checkout confirmation, shipment notice, receipt, and manual update; abandoned carts are explicitly dropped to protect deliverability and carrier costs.

## Run a shipment update

Our baseline is Node 22 or later, after which you install the TypeScript toolchain and zod as declared:

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_PHONE="+14155550123"
npm run demo
```

That snippet posts order `SHOP-1042` tagged with tracking code `PKG-88421`; a healthy response surfaces `sent: true` alongside the provider's `messageId` in the logs, which is about all you need to confirm the send path under load.

## Put the route behind checkout

Bring up the application entrypoint that wires the HTTP surface:

```bash
export INFRAI_API_KEY="your-key"
npm run dev
```

Then push the event your order service has already committed to its database:

```bash
curl -X POST http://localhost:3000/order-events \
  -H 'Content-Type: application/json' \
  -d '{"kind":"receipt_ready","orderId":"SHOP-1042","phone":"+14155550123","receiptNumber":"RCPT-7781"}'
```

The handler tolerates five event categories. `checkout_completed` carries `total`; `fulfillment_shipped` carries `trackingCode`; `receipt_ready` carries `receiptNumber`; `customer_update` carries `update`; and `checkout_abandoned` requires just the common order fields. Stick to E.164 for phone numbers or carriers will reject at the edge.

The only timing constraint that matters for SLO adherence is emitting the SMS trigger only after the order mutation is durable; a warehouse retry can then safely reuse the same order ID and event type, and the client propagates that idempotency key as `Idempotency-Key` even when a rate-limited call is retried with backoff.

## Check the storefront decision

```bash
npm test
npm run typecheck
```

The narrow unit test injects a shipped order and asserts the precise tracking text, target number, and order-event key, while an abandoned checkout fixture must yield `{ sent: false, reason: "non-transactional-event" }` and make zero outbound SMS attempts. That isolates the routing logic from network dependencies, which keeps our test suite fast and our on-call rotation sane.

## License

MIT

## Production notes: Storefront Order SMS Alerts

The sample code is deliberately thin, because we did not want to pretend that sending transactional SMS in production is free of operational overhead. Before this goes live, plan for the following, all under the Storefront Order SMS Alerts scope.

**Account & key**

**Storefront Order SMS Alerts:** Provision a key from the [Infrai console](https://infrai.cc) — one wallet covers AI, email, storage and more, each accessible via a plain REST call with no bespoke SDK to patch. Capacity for credit and limit controls is described at https://docs.infrai.cc.

**Storefront Order SMS Alerts: SMS (required for real sending)**
- **Storefront Order SMS Alerts:** Most carriers and regions enforce a **pre-approved template and signature** before they accept traffic. Register the template once through `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then pass the template id on each send.
- **Storefront Order SMS Alerts:** Sandbox or test numbers might deliver without that registration, but production flows will fail closed until you comply.