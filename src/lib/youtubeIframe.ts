// Wspólne ładowanie YouTube IFrame API (jeden skrypt na całą stronę).
// Używane przez rolki (EraReels, FeedReels), żeby nie wstrzykiwać skryptu dwa razy.
/* eslint-disable @typescript-eslint/no-explicit-any */
let ytApiPromise: Promise<any> | null = null;

export function loadYT(): Promise<any> {
  const w = window as any;
  if (w.YT && w.YT.Player) return Promise.resolve(w.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { prev?.(); resolve(w.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return ytApiPromise;
}
