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
  // Step 1: Get pre-signed URL from edge function
  const { data, error } = await supabase.functions.invoke("r2-signed-url", {
    body: {
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      folder,
    },
  });

  if (error || !data?.uploadUrl) {
    throw new Error(error?.message || data?.error || "Failed to get upload URL");
  }

  const { uploadUrl, publicUrl, key } = data;

  // Step 2: Upload directly to R2
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
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
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.timeout = 600000; // 10 min for large files

    xhr.send(file);
  });

  return { publicUrl, key };
}
