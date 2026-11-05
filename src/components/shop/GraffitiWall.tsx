// Graffiti z nazwą GROUAROCK na pierwszy ekran sklepu (bez ściany — wprost na tle strony): napis „wymalowany” sprayem
// (wypełnienie gradientem, czarny kontur, biała obwódka, cień 3D). Bez zacieków i podpisu — sam napis.
// Jednorazowa animacja „malowania” (bez wiecznych animacji), wyłączona przy prefers-reduced-motion.
// Czcionka Sedgwick Ave Display (SIL OFL) — self-hosted, ładowana tylko na stronie sklepu.
const CSS = `
@font-face{font-family:"Sedgwick Ave Display";src:url("/fonts/sedgwick-ave-display-latin.woff2") format("woff2");font-display:swap;font-weight:400}
.gw-word{position:relative;isolation:isolate;display:inline-block;font-family:"Sedgwick Ave Display","Permanent Marker","Comic Sans MS",cursive;
  font-size:clamp(3.4rem,17vw,9.5rem);line-height:.95;letter-spacing:.01em;transform:rotate(-4deg)}
.gw-word span{display:block;white-space:nowrap}
.gw-shadow{position:absolute;inset:0;z-index:-2;color:#050505;-webkit-text-stroke:16px #050505;transform:translate(.09em,.08em)}
.gw-halo{position:absolute;inset:0;color:#fff;-webkit-text-stroke:12px #fff}
.gw-fill{position:relative;z-index:1;color:transparent;-webkit-text-stroke:3px #111;
  background:linear-gradient(175deg,#fde047 0%,#fb923c 32%,#f97316 52%,#ec4899 80%,#a21caf 100%);
  -webkit-background-clip:text;background-clip:text}
.gw-shine{position:absolute;inset:0;z-index:2;color:transparent;
  background:linear-gradient(175deg,rgba(255,255,255,.75) 0%,rgba(255,255,255,0) 28%);-webkit-background-clip:text;background-clip:text;pointer-events:none}
@media (prefers-reduced-motion:no-preference){
  .gw-paint{animation:gw-spray 1.1s cubic-bezier(.6,.05,.3,1) .15s both}
}
@keyframes gw-spray{from{clip-path:inset(-20% 100% -20% -5%);filter:blur(3px)}to{clip-path:inset(-20% -5% -20% -5%);filter:blur(0)}}
`;

const WORD = "GROUAROCK";

export function GraffitiWall({ label }: { label: string }) {
  return (
    <section aria-label={label} className="mx-auto max-w-5xl px-4 pt-5">
      <style>{CSS}</style>
      <div className="relative px-2 pb-4 pt-4 text-center sm:pb-6 sm:pt-6">
        <p className="sr-only">{WORD}</p>
        <div className="gw-paint" aria-hidden="true">
          <div className="gw-word">
            <span className="gw-shadow">{WORD}</span>
            <span className="gw-halo">{WORD}</span>
            <span className="gw-fill">{WORD}</span>
            <span className="gw-shine">{WORD}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
