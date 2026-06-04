import { Environment, Paddle, EventName } from 'npm:@paddle/paddle-node-sdk';

export { EventName };

export type PaddleEnv = 'sandbox' | 'live';

// Direct Paddle API — no Lovable gateway
const PADDLE_API = {
  sandbox: 'https://sandbox-api.paddle.com',
  live: 'https://api.paddle.com',
};

export function getConnectionApiKey(env: PaddleEnv): string {
  return env === 'sandbox'
    ? Deno.env.get('PADDLE_SANDBOX_API_KEY')!
    : Deno.env.get('PADDLE_LIVE_API_KEY')!;
}

export function getPaddleClient(env: PaddleEnv): Paddle {
  const apiKey = getConnectionApiKey(env);
  return new Paddle(apiKey, {
    environment: env === 'sandbox' ? Environment.sandbox : Environment.production,
  });
}

export async function gatewayFetch(env: PaddleEnv, path: string, init?: RequestInit): Promise<Response> {
  const apiKey = getConnectionApiKey(env);
  const baseUrl = PADDLE_API[env];
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...init?.headers,
    },
  });
}

export function getWebhookSecret(env: PaddleEnv): string {
  return env === 'sandbox'
    ? Deno.env.get('PAYMENTS_SANDBOX_WEBHOOK_SECRET')!
    : Deno.env.get('PAYMENTS_LIVE_WEBHOOK_SECRET')!;
}

export async function verifyWebhook(req: Request, env: PaddleEnv) {
  const signature = req.headers.get('paddle-signature');
  const body = await req.text();
  const secret = getWebhookSecret(env);

  if (!signature || !body) {
    throw new Error('Missing signature or body');
  }

  const paddle = getPaddleClient(env);
  return await paddle.webhooks.unmarshal(body, secret, signature);
}
