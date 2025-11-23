/**
 * Supabase Storage Helper
 * 
 * Handles file uploads to Supabase Storage buckets
 */

import { createClient } from './client';

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

interface UploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * Upload an image to the clothing_images bucket
 * 
 * @param file - The image file to upload
 * @param userId - The user ID (for path organization)
 * @returns Upload result with public URL
 */
export async function uploadClothingImage(
  file: File,
  userId: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  try {
    const supabase = createClient();
    const bucket = 'clothing_images';

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return {
        success: false,
        error: 'File must be an image',
      };
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'Image must be smaller than 5MB',
      };
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const hasBrowserSupport = typeof window !== 'undefined' && typeof XMLHttpRequest !== 'undefined';

    const canUseProgress = Boolean(supabaseUrl && anonKey && hasBrowserSupport);

    if (canUseProgress && supabaseUrl && anonKey) {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (accessToken) {
        return await uploadWithProgress({
          file,
          filePath,
          supabase,
          supabaseUrl,
          anonKey,
          accessToken,
          bucket,
          options,
        });
      }
    }

    // Fallback upload without granular progress (e.g., server-side or missing env)
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    options.onProgress?.(100);

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return {
      success: true,
      url: publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Unexpected upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

interface UploadWithProgressParams {
  file: File;
  filePath: string;
  supabase: ReturnType<typeof createClient>;
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  bucket: string;
  options: UploadOptions;
}

const uploadWithProgress = ({
  file,
  filePath,
  supabase,
  supabaseUrl,
  anonKey,
  accessToken,
  bucket,
  options,
}: UploadWithProgressParams): Promise<UploadResult> => {
  return new Promise((resolve) => {
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
      const percent = Math.round((event.loaded / event.total) * 100);
      options.onProgress(percent);
    };

    xhr.onerror = () => {
      finalize({ success: false, error: 'Upload failed' });
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(100);
        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);
        finalize({ success: true, url: publicUrl, path: filePath });
      } else {
        let message = 'Upload failed';
        try {
          const response = JSON.parse(xhr.responseText);
          message = response?.error ?? message;
        } catch (_) {
          // Ignore JSON parse errors
        }
        finalize({ success: false, error: message });
      }
    };

    const endpoint = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;
    xhr.open('POST', endpoint);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('x-upsert', 'false');
    options.onProgress?.(0);
    xhr.send(file);
  });
};

/**
 * Delete an image from the clothing_images bucket
 * 
 * @param path - The storage path of the file to delete
 * @returns Success status
 */
export async function deleteClothingImage(path: string): Promise<boolean> {
  try {
    const supabase = createClient();

    const { error } = await supabase.storage
      .from('clothing_images')
      .remove([path]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected delete error:', error);
    return false;
  }
}

/**
 * Upload an avatar image to the avatars bucket
 * 
 * @param file - The avatar image file
 * @param userId - The user ID
 * @returns Upload result with public URL
 */
export async function uploadAvatarImage(
  file: File,
  userId: string
): Promise<UploadResult> {
  try {
    const supabase = createClient();

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return {
        success: false,
        error: 'File must be an image',
      };
    }

    // Validate file size (max 2MB for avatars)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'Avatar must be smaller than 2MB',
      };
    }

    // Generate filename (overwrite existing avatar)
    const fileExt = file.name.split('.').pop();
    const fileName = `avatar.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage (upsert to replace existing)
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true, // Replace existing avatar
      });

    if (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.path);

    return {
      success: true,
      url: publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Unexpected upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}
