/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer ships ESM and breaks when Next minifies it into a
  // server chunk (runtime "Cannot read properties of undefined (reading 'S')"
  // during PDF render). Externalize it so the un-bundled node_modules copy is
  // used as-is. Keeps the <10s SLA intact and the render working in `next start`.
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    // Larger streaming responses from SSE scraper progress.
    serverActions: { bodySizeLimit: "2mb" }
  }
};
export default nextConfig;
