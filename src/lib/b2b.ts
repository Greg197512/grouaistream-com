// Obieg zlecenia B2B (Aurora → admin → klient), wspólny dla panelu admina, panelu klienta i serwera.
export type B2BStage = "received" | "offer_sent" | "confirmed" | "in_progress" | "completed" | "cancelled";

export const B2B_STEPS: { key: string; label: string }[] = [
  { key: "received", label: "Przyjęte" },
  { key: "offer_sent", label: "Oferta" },
  { key: "paid", label: "Opłacone" },
  { key: "in_progress", label: "W realizacji" },
  { key: "completed", label: "Gotowe" },
];

/** Indeks bieżącego kroku osi czasu (płatność jest osobnym polem payment_status). */
export function b2bStepIndex(status?: string | null, payment?: string | null): number {
  if (status === "completed") return 4;
  if (status === "in_progress") return 3;
  if (payment === "paid") return 2;
  if (status === "offer_sent" || status === "confirmed") return 1;
  return 0;
}

/** Tytuł przelewu — krótki i jednoznaczny. */
export const b2bRef = (id: string) => `B2B-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

export const B2B_STATUS_LABEL: Record<string, string> = {
  received: "Przyjęte", offer_sent: "Oferta wysłana", confirmed: "Oferta zaakceptowana",
  in_progress: "W realizacji", completed: "Gotowe", cancelled: "Anulowane",
};
