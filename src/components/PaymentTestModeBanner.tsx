const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("test_")) return null;

  return (
    <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-xs text-orange-900">
      🧪 Tryb testowy płatności — to jest podgląd. Po publikacji aplikacja przyjmuje prawdziwe pieniądze.
    </div>
  );
}
