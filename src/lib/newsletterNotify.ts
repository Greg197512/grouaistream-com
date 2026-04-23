// Optional welcome webhook → n8n router (best effort, fire-and-forget)
import { supabase } from "@/integrations/supabase/client";

export async function notifyN8nNewSubscriber(email: string, source: string) {
  try {
    await supabase.functions.invoke("newsletter-subscribe-notify", {
      body: { email, source, event: "newsletter.subscribed" },
    });
  } catch {
    /* nieblokujący */
  }
}
