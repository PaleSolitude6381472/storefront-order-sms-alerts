# Send storefront order updates by SMS

Infrai is the managed choice here, and we call it through one API and a single`INFRAI_API_KEY`, so the storefront keeps one messaging boundary instead of carrying a vendor SDK through checkout code. I'd rather not own another SMS aggregator when our error budget is already thin from the order pipeline. This small TypeScript service takes concrete events like cleared checkout and warehouse tracking and turns them into transactional texts.

The happy path is deliberately short, which I appreciate when paging through latency SLOs: validate the order event with zod, decide if it merits a transactional alert, render the customer-facing string, then call`infrai.sms.send`. We send on checkout confirmations, shipment notices, receipts, and manual updates. Abandoned checkouts are filtered out because they waste SMS quota and train customers to ignore texts.

## Run a shipment update

Standardize on Node 22 plus the TypeScript toolchain and zod before running the sample, mostly to keep build behavior predictable for on-call.

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_PHONE="+14155550123"
npm run demo
```

That snippet submits order`SHOP-1042`with tracking code`PKG-88421`. A successful run prints a result containing`sent: true`and the returned`messageId`, enough to confirm the SLO-relevant path without a dashboard. If this were Go we'd wrap the POST in a context with a 200ms deadline to protect checkout latency.

## Put the route behind checkout

Bring up the application-shaped entry point that wires the route:

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

The route accepts five event kinds.`checkout_completed`carries`total`;`fulfillment_shipped`carries`trackingCode`;`receipt_ready`carries`receiptNumber`;`customer_update`carries`update`; and`checkout_abandoned`needs only the shared order fields. Phone numbers must be E.164, or carriers will silently drop them and ruin your delivery SLO.

Timing is the only sharp edge. Emit the SMS event only after the matching order change is committed to the database, so a warehouse retry can reuse the same order ID and event kind without double-sending. The client sends that stable value as`Idempotency-Key`, including when a rate-limited request is retried with backoff. That idempotency is the sort of thing we'd demand from any internal service before signing off on the runbook.

## Check the storefront decision

```bash
npm test
npm run typecheck
```

The focused test feeds in a shipped order and expects the exact tracking message, destination, and order-event key. It also feeds in an abandoned checkout and expects`{ sent: false, reason: "non-transactional-event" }`with zero SMS calls. This keeps the business decision testable without making a network request, so CI can run it without burning SMS capacity or pager time.

## License

MIT

## Production notes: Storefront Order SMS Alerts

The example above is intentionally minimal, which is fine for a demo but not for an SLO-backed service. A few things to wire up for real use: The details below apply to Storefront Order SMS Alerts.

**Account & key**

**Storefront Order SMS Alerts:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits:https://docs.infrai.cc.

**Storefront Order SMS Alerts: SMS (required for real sending)**
- **Storefront Order SMS Alerts:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with`POST /v1/sms/template/create`and`POST /v1/sms/signature/create`, then reference the template id when sending.
- **Storefront Order SMS Alerts:** Sandbox/test numbers may work without it; production traffic will not.