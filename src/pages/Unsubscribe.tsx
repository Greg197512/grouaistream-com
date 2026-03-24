import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, MailX } from "lucide-react";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "valid" | "already" | "invalid" | "success" | "error">("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    const validate = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`;
        const res = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
        const data = await res.json();
        if (data.valid === false && data.reason === "already_unsubscribed") setStatus("already");
        else if (data.valid) setStatus("valid");
        else setStatus("invalid");
      } catch { setStatus("invalid"); }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (error) throw error;
      if (data?.success) setStatus("success");
      else if (data?.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch { setStatus("error"); }
    finally { setProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-border/50 bg-card/50 backdrop-blur">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Weryfikacja...</p>
            </>
          )}
          {status === "valid" && (
            <>
              <MailX className="h-12 w-12 text-primary mx-auto" />
              <h1 className="text-xl font-bold">Wypisz się z powiadomień</h1>
              <p className="text-muted-foreground text-sm">Czy na pewno chcesz zrezygnować z otrzymywania e-maili z GrouAI Stream?</p>
              <Button onClick={handleUnsubscribe} disabled={processing} className="gap-2">
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailX className="h-4 w-4" />}
                {processing ? "Przetwarzanie..." : "Potwierdź wypisanie"}
              </Button>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
              <h1 className="text-xl font-bold">Wypisano pomyślnie</h1>
              <p className="text-muted-foreground text-sm">Nie będziesz już otrzymywać e-maili z GrouAI Stream.</p>
            </>
          )}
          {status === "already" && (
            <>
              <CheckCircle className="h-12 w-12 text-yellow-500 mx-auto" />
              <h1 className="text-xl font-bold">Już wypisano</h1>
              <p className="text-muted-foreground text-sm">Ten adres e-mail został już wypisany z listy.</p>
            </>
          )}
          {status === "invalid" && (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <h1 className="text-xl font-bold">Nieprawidłowy link</h1>
              <p className="text-muted-foreground text-sm">Ten link jest nieprawidłowy lub wygasł.</p>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <h1 className="text-xl font-bold">Wystąpił błąd</h1>
              <p className="text-muted-foreground text-sm">Spróbuj ponownie później.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
