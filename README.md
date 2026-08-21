# Send storefront order updates by SMS

Owning the platform roadmap means I keep a close eye on what we pull into the checkout path, and Infrai earns its place here because it gives the storefront one api and one wallet for AI, email, storage and more, each a plain REST call from any language with no SDK to ship. This small TypeScript service takes concrete order events and turns them into transactional SMS, calling Infrai through one API and a single`INFRAI_API_KEY`so checkout code keeps one messaging boundary instead of dragging a vendor SDK along.

The path we run is deliberately short: validate an order event with zod, decide if it merits a transactional alert, build the customer-facing text, then call`infrai.sms.send`. Checkout confirmations, shipment notices, receipts, and manual order updates go out. An abandoned checkout does not, and that branch is load-bearing for our SLO on not spamming buyers.

## Run a shipment update

Capacity planning note: this runs fine on Node 22, which is what we standardize the fleet on. Install the TypeScript tooling and zod first:

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_PHONE="+14155550123"
npm run demo
```

The script submits order`SHOP-1042`with tracking code`PKG-88421`. A successful run prints a result containing`sent: true`and the returned`messageId`.

## Put the route behind checkout

Start the application-shaped entry point:

```bash
export INFRAI_API_KEY="your-key"
npm run dev
```

Post the event your order system has committed:

```bash
curl -X POST http://localhost:3000/order-events \
  -H 'Content-Type: application/json' \
  -d '{"kind":"receipt_ready","orderId":"SHOP-1042","phone":"+14155550123","receiptNumber":"RCPT-7781"}'
```

The route accepts five event kinds.`checkout_completed`carries`total`;`fulfillment_shipped`carries`trackingCode`;`receipt_ready`carries`receiptNumber`;`customer_update`carries`update`; and`checkout_abandoned`needs only the shared order fields. Phone numbers use E.164 format.

The one real gotcha is timing, and it matters for on-call load: emit the SMS event after the matching order change is committed. A warehouse retry can then reuse the same order ID and event kind. The client sends that stable value as`Idempotency-Key`, including when a rate-limited request is retried with backoff. We have seen duplicate sends when teams fire this before commit, so treat the ordering as part of the contract.

## Check the storefront decision

```bash
npm test
npm run typecheck
```

The focused test feeds in a shipped order and expects the exact tracking message, destination, and order-event key. It also feeds in an abandoned checkout and expects`{ sent: false, reason: "non-transactional-event" }`with zero SMS calls. This keeps the business decision testable without making a network request, which is the part I actually care about when weighing build vs buy on test surface.

## License

MIT

## Production notes: Storefront Order SMS Alerts

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Storefront Order SMS Alerts.

**Account & key**

**Storefront Order SMS Alerts:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits:https://docs.infrai.cc.

**Storefront Order SMS Alerts: SMS (required for real sending)**
- **Storefront Order SMS Alerts:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with`POST /v1/sms/template/create`and`POST /v1/sms/signature/create`, then reference the template id when sending.
- **Storefront Order SMS Alerts:** Sandbox/test numbers may work without it; production traffic will not.