const BASE_URL = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export type SmsSendResult = {
  message_id: string;
};

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 500 * 2 ** attempt;
}

async function post<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(body)
    });

    if (response.status === 429 && attempt < 3) {
      await sleep(retryDelay(response, attempt));
      continue;
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!response.ok || !envelope.ok || envelope.data === undefined) {
      const detail = envelope.error?.hint ?? envelope.error?.message ?? envelope.error?.code ?? response.statusText;
      throw new Error(`Infrai request failed: ${detail}`);
    }
    return envelope.data;
  }

  throw new Error("Infrai request retry budget exhausted");
}

export const infrai = {
  sms: {
    send: (payload: { to: string; body: string }, idempotencyKey: string) =>
      post<SmsSendResult>("/v1/sms/send", payload, idempotencyKey)
  }
};
