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
  },
};

export default nextConfig;
