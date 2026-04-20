const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("test_")) return null;

  return (
    <div className="w-full bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-xs text-amber-200">
      🧪 <strong>Tryb testowy płatności</strong> — żadne realne pieniądze nie zostaną pobrane.
      Użyj karty testowej <code className="font-mono bg-amber-500/20 px-1.5 py-0.5 rounded">4242 4242 4242 4242</code>,
      dowolna data w przyszłości, dowolny CVC.
    </div>
  );
}
