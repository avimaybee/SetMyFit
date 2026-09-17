'use client';

/**
 * R2 upload helper (client). Files are POSTed to /api/uploads
 * (authenticated), which stores them in Cloudflare R2 and returns
 * a stable public URL.
 *
 * Keeps the same interface as the old Supabase storage helper so
 * call sites barely change.
 */
import { getIdToken } from './firebase/client';

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

interface UploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export async function uploadClothingImage(
  file: File,
  _userId: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  try {
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'File must be an image' };
    }
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return { success: false, error: 'Image must be smaller than 5MB' };
    }

    const token = await getIdToken();
    if (!token) return { success: false, error: 'You must be logged in.' };

    return await new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      let settled = false;
      const finalize = (result: UploadResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      if (options.signal) {
        if (options.signal.aborted) {
          finalize({ success: false, error: 'Upload aborted' });
          return;
        }
        options.signal.addEventListener('abort', () => {
          xhr.abort();
          finalize({ success: false, error: 'Upload aborted' });
        }, { once: true });
      }

      xhr.upload.onprogress = (event) => {
        if (!options.onProgress || !event.lengthComputable) return;
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onerror = () => finalize({ success: false, error: 'Upload failed' });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const payload = JSON.parse(xhr.responseText) as UploadResult & { url?: string; key?: string };
            if (payload?.success && payload.url) {
              options.onProgress?.(100);
              finalize({ success: true, url: payload.url, key: payload.key });
            } else {
              finalize({ success: false, error: payload?.error || 'Upload failed' });
            }
          } catch {
            finalize({ success: false, error: 'Upload failed' });
          }
        } else {
          let message = 'Upload failed';
          try {
            const payload = JSON.parse(xhr.responseText) as { error?: string };
            message = payload?.error ?? message;
          } catch { /* ignore */ }
          // Never leak infra details (env names) into user-facing toasts.
          if (/not configured|R2_|env/i.test(message)) {
            message = 'Image uploads are offline right now. Try again later.';
          }
          finalize({ success: false, error: message });
        }
      };

      const form = new FormData();
      form.append('file', file);
      xhr.open('POST', '/api/uploads');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      options.onProgress?.(0);
      xhr.send(form);
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
  }
}
