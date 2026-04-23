import { supabase } from "@/integrations/supabase/client";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

declare global {
  interface Window {
    Paddle: any;
  }
}

let paddleInitialized = false;

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

/**
 * Paddle account is approved — checkout is enabled in both sandbox and live.
 */
export function isLiveCheckoutEnabled(): boolean {
  return true;
}

export async function initializePaddle() {
  if (paddleInitialized) return;
  if (!clientToken) throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src*="paddle/v2/paddle.js"]');
    const onReady = () => {
      const environment = clientToken.startsWith("test_") ? "sandbox" : "production";
      window.Paddle.Environment.set(environment);
      window.Paddle.Initialize({ token: clientToken });
      paddleInitialized = true;
      resolve();
    };

    if (existing && window.Paddle) return onReady();

    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = onReady;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

const priceCache = new Map<string, string>();

export async function getPaddlePriceId(priceId: string): Promise<string> {
  if (priceCache.has(priceId)) return priceCache.get(priceId)!;
  const environment = getPaddleEnvironment();
  const { data, error } = await supabase.functions.invoke("get-paddle-price", {
    body: { priceId, environment },
  });
  if (error || !data?.paddleId) {
    throw new Error(`Failed to resolve price: ${priceId}`);
  }
  priceCache.set(priceId, data.paddleId);
  return data.paddleId;
}

export interface OpenCheckoutOptions {
  priceId: string;
  quantity?: number;
  customerEmail?: string;
  customData?: Record<string, string>;
  successUrl?: string;
}

export async function openPaddleCheckout(options: OpenCheckoutOptions) {
  await initializePaddle();
  const paddlePriceId = await getPaddlePriceId(options.priceId);

  window.Paddle.Checkout.open({
    items: [{ priceId: paddlePriceId, quantity: options.quantity ?? 1 }],
    customer: options.customerEmail ? { email: options.customerEmail } : undefined,
    customData: options.customData,
    settings: {
      displayMode: "overlay",
      successUrl: options.successUrl || `${window.location.origin}/?checkout=success`,
      allowLogout: false,
      variant: "one-page",
    },
  });
}
