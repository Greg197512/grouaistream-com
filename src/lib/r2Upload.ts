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

interface ProxyUploadResponse {
  publicUrl: string;
  key: string;
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

function parseJsonResponse<T>(responseText: string, fallbackMessage: string): T {
  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

async function uploadToR2ViaProxy({
  file,
  folder,
  onProgress,
}: R2UploadOptions): Promise<R2UploadResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-upload-proxy`;
  const formData = new FormData();

  formData.append("file", file, file.name);
  formData.append("folder", folder);

  return new Promise<R2UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint, true);
    xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

    const accessToken = sessionData.session?.access_token;
    xhr.setRequestHeader(
      "Authorization",
      `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
    );

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const payload = parseJsonResponse<ProxyUploadResponse>(
          xhr.responseText,
          "Upload proxy returned an invalid response"
        );

        if (!payload.publicUrl || !payload.key) {
          reject(new Error(payload.error || "Upload proxy did not return file URL"));
          return;
        }

        resolve({ publicUrl: payload.publicUrl, key: payload.key });
      } else {
        reject(new Error(`Upload proxy failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Proxy upload failed — połączenie zostało przerwane"));
    xhr.ontimeout = () => reject(new Error("Proxy upload timed out"));
    xhr.timeout = 600000;
    xhr.send(formData);
  });
}

/**
  * Upload a file to Cloudflare R2.
  * Primary: proxy upload through edge function (avoids CORS issues).
  * Fallback: signed URL direct PUT (faster for large files if CORS is configured).
 */
export async function uploadToR2({
  file,
  folder = "tracks",
  onProgress,
}: R2UploadOptions): Promise<R2UploadResult> {
  // Always use proxy — avoids CORS issues with direct R2 PUT
  return uploadToR2ViaProxy({ file, folder: folder || "tracks", onProgress });
}
