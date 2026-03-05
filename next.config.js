/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Evita erro de cache do webpack no Windows (ex.: ENOENT ao renomear .pack.gz)
  webpack: (config, { dev }) => {
    if (dev && process.platform === 'win32') {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
