/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Não empacota no servidor: evita "Object.defineProperty called on non-object" com pdf-parse
  serverExternalPackages: ['pdf-parse'],
  // Evita erros de chunk/cache no Windows (ex.: Cannot find module './682.js')
  webpack: (config, { dev }) => {
    if (dev && process.platform === 'win32') {
      config.cache = false;
    }
    return config;
  },
  // Reduz risco de chunks quebrados em dev
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};

module.exports = nextConfig;
