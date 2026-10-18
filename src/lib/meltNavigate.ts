/** Krótki „rozpływ” przycisku, potem ta sama nawigacja co wcześniej. */
export function meltNavigate(
  navigate: (href: string) => void,
  href: string,
  el?: HTMLElement | null,
) {
  const reduced =
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced && el) el.classList.add("is-melting");
  window.setTimeout(() => {
    navigate(href);
    if (el) window.setTimeout(() => el.classList.remove("is-melting"), 80);
  }, reduced ? 0 : 380);
}
