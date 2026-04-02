import { supabase } from "@/integrations/supabase/client";

interface R2UploadOptions {
  file: File;
  folder?: string;
  onProgress?: (pct: number) => void;
}

interface R2UploadResult {
  publicUrl: string;
  key: string;
}

interface SignedUploadResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  method?: string;
  error?: string;
}

function parseUploadError(responseText: string, status: number): string {
  const code = responseText.match(/<Code>([^<]+)<\/Code>/)?.[1];
  const message = responseText.match(/<Message>([^<]+)<\/Message>/)?.[1];

  if (code || message) {
    return `Upload failed (${status}): ${code ?? "R2Error"}${message ? ` — ${message}` : ""}`;
  }

  return `Upload failed with status ${status}`;
}

/**
 * Upload a file to Cloudflare R2 via pre-signed URL.
 * 1. Calls the edge function to get a signed upload URL
 * 2. PUTs the file directly to R2
 * 3. Returns the public URL
 */
export async function uploadToR2({
  file,
  folder = "tracks",
  onProgress,
}: R2UploadOptions): Promise<R2UploadResult> {
  const { data, error } = await supabase.functions.invoke<SignedUploadResponse>("r2-signed-url", {
    body: {
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      folder,
    },
  });

  if (error || !data?.uploadUrl) {
    throw new Error(error?.message || data?.error || "Failed to get upload URL");
  }

  const { uploadUrl, publicUrl, key, method = "PUT" } = data;

  if (method !== "PUT") {
    throw new Error(`Unsupported upload method: ${method}`);
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(parseUploadError(xhr.responseText, xhr.status)));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload — zwykle oznacza błędny podpis URL albo odpowiedź blokowaną przez CORS po stronie R2"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.timeout = 600000; // 10 min for large files

    xhr.send(file);
  });

  return { publicUrl, key };
}
