import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date to a relative time string (e.g., "3 days ago")
 */
export function getRelativeTime(date: string | Date | null): string {
  if (!date) return "Never worn";
  
  const now = new Date();
  const past = new Date(date);
  const diffInMs = now.getTime() - past.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return "Today";
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
  return `${Math.floor(diffInDays / 365)} years ago`;
}

/**
 * Format temperature with degree symbol
 */
export function formatTemp(temp: number): string {
  return `${Math.round(temp)}°C`;
}

const DATA_URL_REGEX = /^data:(.+);base64,(.*)$/;

/**
 * Parse a data URL (data:mime;base64,XXXX) into its base64 payload and mime type
 */
export function parseDataUrl(
  value: string,
  fallbackMimeType: string = "application/octet-stream"
): { base64: string; mimeType: string } {
  if (!value) {
    return { base64: "", mimeType: fallbackMimeType };
  }

  const trimmed = value.trim();
  const match = trimmed.match(DATA_URL_REGEX);

  if (match && match.length === 3) {
    return {
      mimeType: match[1],
      base64: match[2],
    };
  }

  return {
    base64: trimmed,
    mimeType: fallbackMimeType,
  };
}

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
};

const decodeBase64ToBytes = (base64: string): Uint8Array => {
  if (typeof atob === "function") {
    const binary = atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  throw new Error("Base64 decoding is not supported in this environment.");
};

/**
 * Convert a data URL into a File so it can be uploaded via Supabase Storage
 */
export function dataUrlToFile(dataUrl: string, preferredFileName?: string): File {
  if (typeof File === "undefined" || typeof Blob === "undefined") {
    throw new Error("File/Blob APIs are not available in this environment.");
  }

  const { base64, mimeType } = parseDataUrl(dataUrl, "image/webp");
  const bytes = decodeBase64ToBytes(base64);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mimeType });

  const extension = MIME_EXTENSION_MAP[mimeType] || "bin";
  const sanitizedName = preferredFileName
    ? (() => {
        const base = preferredFileName.includes(".")
          ? preferredFileName.slice(0, preferredFileName.lastIndexOf("."))
          : preferredFileName;
        return `${base}.${extension}`;
      })()
    : `wardrobe-${Date.now()}.${extension}`;

  return new File([blob], sanitizedName, { type: mimeType });
}
