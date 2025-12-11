import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // When Turbopack infers the workspace root incorrectly in monorepos or nested projects,
  // setting `turbopack.root` ensures the build uses the correct directory.
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tddifonhdaloweyadnop.supabase.co",
      },
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
