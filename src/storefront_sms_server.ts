import { createServer } from "node:http";
import { ZodError } from "zod";
import { notifyCustomer, orderEventSchema } from "./order_alert_service.ts";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/order-events") {
    response.writeHead(404).end(JSON.stringify({ error: "route not found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const event = orderEventSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await notifyCustomer(event);
    response.writeHead(200).end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "invalid order event" }));
      return;
    }
    const message = error instanceof Error ? error.message : "request failed";
    response.writeHead(502).end(JSON.stringify({ error: message }));
  }
});

server.listen(port, () => console.log(`Order event route listening on http://localhost:${port}`));
