/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The registry is a read-only catalog, so ship it as static assets on Pages.
  output: "export",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "huggingface.co",
      },
      {
        protocol: "https",
        hostname: "pollen-robotics.com",
      },
    ],
  },
};

export default nextConfig;
