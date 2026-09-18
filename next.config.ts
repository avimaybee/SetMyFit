import path from "path";
import type { NextConfig } from "next";

// R2 public hostname for next/image (parsed from env, with r2.dev fallback).
// Set R2_PUBLIC_URL (or NEXT_PUBLIC_R2_PUBLIC_URL) to your bucket's public URL.
const r2PublicUrl =
  process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
let r2Hostname: string | null = null;
try {
  if (r2PublicUrl) r2Hostname = new URL(r2PublicUrl).hostname;
} catch {
  r2Hostname = null;
}

const nextConfig: NextConfig = {
  // When Turbopack infers the workspace root incorrectly in monorepos or nested projects,
  // setting `turbopack.root` ensures the build uses the correct directory.
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      // Cloudflare R2 public bucket(s)
      ...(r2Hostname ? [{ protocol: "https" as const, hostname: r2Hostname }] : []),
      { protocol: "https" as const, hostname: "*.r2.dev" },
      { protocol: "https" as const, hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https" as const, hostname: "*.googleusercontent.com" },
      { protocol: "https" as const, hostname: "*.firebasestorage.app" },
      { protocol: "https" as const, hostname: "firebasestorage.googleapis.com" },
      {
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
    // Allow data URIs for placeholder images
    dangerouslyAllowSVG: true,
    contentDispositionType: 'inline',
    // Cache optimized images for 31 days to reduce re-transformations
    minimumCacheTTL: 60 * 60 * 24 * 31,
    // Reduce device sizes to common breakpoints only (default has 8 sizes)
    deviceSizes: [640, 1080, 1920],
    // Limit image sizes for srcset
    imageSizes: [128, 256, 384],
  },
};

export default nextConfig;
