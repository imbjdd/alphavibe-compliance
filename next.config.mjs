/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    // This is experimental but can be helpful for debugging
    instrumentationHook: true
  }
};

export default nextConfig;
