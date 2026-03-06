/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ["mui-tel-input"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dynopay.com",
      },
      {
        protocol: "https",
        hostname: "**.preview.emergentagent.com",
      },
    ],
  },
};

export default nextConfig;
