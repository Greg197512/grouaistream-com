import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "../../api/voice";

const mp3 = () => new Response(new Uint8Array(2000), { status: 200, headers: { "content-type": "audio/mpeg" } });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
// Środowisko testowe (jsdom) nie ma AbortSignal.timeout — runtime edge Vercela ma.
if (!("timeout" in AbortSignal)) (AbortSignal as unknown as { timeout: () => AbortSignal }).timeout = () => new AbortController().signal;

describe("/api/voice (głos Novy)", () => {
  it("bez kluczy: Google, kobiecy głos w języku słuchacza, cache CDN", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string) => { calls.push(String(u)); return mp3(); }));
    const r = await handler(new Request("https://x/api/voice?l=nl&t=" + encodeURIComponent("Welkom bij GrouaRadio!")));
    expect(r.status).toBe(200);
    expect(r.headers.get("x-tts-engine")).toBe("google");
    expect(r.headers.get("cache-control")).toContain("s-maxage");
    expect(calls[0]).toContain("tl=nl");
  });
  it("z kluczem Azure: Zofia po polsku", async () => {
    vi.stubEnv("AZURE_SPEECH_KEY", "k"); vi.stubEnv("AZURE_SPEECH_REGION", "westeurope");
    let body = "";
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => { body = String(init?.body ?? ""); return mp3(); }));
    const r = await handler(new Request("https://x/api/voice?l=pl&t=" + encodeURIComponent("Cześć, tu Nova.")));
    expect(r.headers.get("x-tts-engine")).toBe("azure");
    expect(body).toContain("pl-PL-ZofiaNeural");
  });
  it("odrzuca puste, za długie i niecenzuralne teksty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => mp3()));
    for (const t of ["", "a".repeat(401), "fuck you", "zobacz https://x.pl"]) {
      const r = await handler(new Request("https://x/api/voice?l=pl&t=" + encodeURIComponent(t)));
      expect(r.status).toBe(400);
    }
  });
});
