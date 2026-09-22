/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  turbopack: {
    root: ".",
  },
};

export default nextConfig;
