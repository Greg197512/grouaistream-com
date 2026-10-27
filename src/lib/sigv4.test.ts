import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { md5Base64, presignUrl, signHeaders } from "./sigv4";

// Oficjalne przykłady z dokumentacji AWS (Signature Version 4, S3).
const creds = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1" };
const date = new Date("2013-05-24T00:00:00Z");

describe("SigV4", () => {
  it("podpisany adres GET zgadza się z przykładem AWS", async () => {
    const url = await presignUrl({ method: "GET", url: "https://examplebucket.s3.amazonaws.com/test.txt", creds, expires: 86400, date });
    expect(url).toContain("X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
  });
  it("nagłówki GET zgadzają się z przykładem AWS (GetBucketLifecycle)", async () => {
    const h = await signHeaders({ method: "GET", url: "https://examplebucket.s3.amazonaws.com/?lifecycle", creds, date });
    expect(h.authorization).toContain("Signature=fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543");
  });
  it("MD5 jak w node:crypto", () => {
    for (const s of ["", "abc", "<CORSConfiguration>" + "x".repeat(200)]) {
      expect(md5Base64(new TextEncoder().encode(s))).toBe(createHash("md5").update(s).digest("base64"));
    }
  });
});
