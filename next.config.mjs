/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The registry is a read-only catalog, so ship it as static assets on Pages.
  output: "export",
};

export default nextConfig;
