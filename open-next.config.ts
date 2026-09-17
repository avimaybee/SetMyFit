import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Defaults are fine for SetMyFit: D1/R2 are reached over HTTPS
  // (D1 REST + S3-compatible API), so no cache/KV wiring is needed.
});
