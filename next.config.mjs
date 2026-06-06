/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Load pdf.js from node_modules at runtime instead of letting webpack bundle
  // it — bundling breaks its worker/font resolution and throws at parse time.
  serverExternalPackages: ['pdfjs-dist'],
  experimental: {
    // Bank PDF statements run a few MB — well over the default 1 MB cap on
    // Server Action request bodies (the Import upload).
    serverActions: { bodySizeLimit: '15mb' },
  },
  // pdfjs-dist ships a canvas optional dep we don't use server-side.
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

export default nextConfig;
