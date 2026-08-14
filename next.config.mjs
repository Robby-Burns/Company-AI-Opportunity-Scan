/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer ships ESM; let Next transpile it.
  transpilePackages: ["@react-pdf/renderer"],
  experimental: {
    // Larger streaming responses from SSE scraper progress.
    serverActions: { bodySizeLimit: "2mb" }
  }
};
export default nextConfig;
