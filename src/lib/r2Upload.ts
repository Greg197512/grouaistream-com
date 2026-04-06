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

const EDGE_PROXY_MAX_BYTES = 20 * 1024 * 1024;

function getSupabaseUrl(): string {
  return import.meta.env.VITE_SUPABASE_URL;
}

function getAnonKey(): string {
  return import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

async function getAuthToken(): Promise<string> {
  // Try to get the current session token from localStorage
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "bvstvawnigyczvofzhps";
  const storageKey = `sb-${projectId}-auth-token`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      const token = parsed?.access_token;
      if (token) return token;
    }
  } catch { /* ignore */ }
  return getAnonKey();
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

async function createSignedUpload({ file, folder }: R2UploadOptions): Promise<SignedUploadResponse> {
  const contentType = file.type || "application/octet-stream";
  const url = `${getSupabaseUrl()}/functions/v1/r2-signed-url`;
  const token = await getAuthToken();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": getAnonKey(),
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileName: file.name,
        contentType,
        folder: folder || "tracks",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`r2-signed-url error (${response.status}): ${errText.substring(0, 200)}`);
    }

    const payload = await response.json() as SignedUploadResponse;

    if (!payload?.uploadUrl || !payload.publicUrl || !payload.key) {
      throw new Error(payload?.error || "Brak podpisanego adresu uploadu");
    }

    return payload;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Połączenie z serwerem przekroczyło limit czasu (30s). Sprawdź połączenie internetowe.");
    }
    throw err;
  }
}

async function uploadToSignedUrl({
  file,
  folder,
  onProgress,
}: R2UploadOptions): Promise<R2UploadResult> {
  const signedUpload = await createSignedUpload({ file, folder });

  return new Promise<R2UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(signedUpload.method || "PUT", signedUpload.uploadUrl, true);

    if (file.type) {
      xhr.setRequestHeader("Content-Type", file.type);
    }

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ publicUrl: signedUpload.publicUrl, key: signedUpload.key });
        return;
      }

      reject(new Error(parseUploadError(xhr.responseText, xhr.status)));
    };

    xhr.onerror = () => reject(new Error("Bezpośredni upload na dysk nie powiódł się"));
    xhr.ontimeout = () => reject(new Error("Bezpośredni upload przekroczył limit czasu"));
    xhr.timeout = 600000;
    xhr.send(file);
  });
}

async function uploadToR2ViaProxy({
  file,
  folder,
  onProgress,
}: R2UploadOptions): Promise<R2UploadResult> {
  const token = await getAuthToken();
  const endpoint = `${getSupabaseUrl()}/functions/v1/r2-upload-proxy`;
  const formData = new FormData();

  formData.append("file", file, file.name);
  formData.append("folder", folder || "tracks");

  return new Promise<R2UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint, true);
    xhr.setRequestHeader("apikey", getAnonKey());
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

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
  const normalizedFolder = folder || "tracks";
  const shouldPreferProxy = file.size <= EDGE_PROXY_MAX_BYTES;

  if (shouldPreferProxy) {
    try {
      return await uploadToR2ViaProxy({ file, folder: normalizedFolder, onProgress });
    } catch (proxyUploadError) {
      console.warn("Proxy R2 upload failed, switching to direct signed upload", proxyUploadError);
      return uploadToSignedUrl({ file, folder: normalizedFolder, onProgress });
    }
  }

  try {
    return await uploadToSignedUrl({ file, folder: normalizedFolder, onProgress });
  } catch (directUploadError) {
    console.warn("Direct R2 upload failed for large file", directUploadError);
    throw directUploadError instanceof Error
      ? directUploadError
      : new Error("Nie udało się wysłać pliku na dysk");
  }
}
