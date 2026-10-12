/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/**": ["./node_modules/jose/**/*"],
  },
};

export default nextConfig;

