/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'localhost',                    // для локальной разработки
      '127.0.0.1',                    // для локальной разработки
      'swapcrm.ru',                 // для продакшна
      'www.swapcrm.ru',             // для продакшна
    ],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5173',                 // порт Vite (если используется)
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',                 // порт бэкенда
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'swapcrm.ru',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'www.swapcrm.ru',
        pathname: '/uploads/**',
      },
    ],
    // Оптимизация изображений
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    formats: ['image/webp'],
  },
  
  // Прокси для API (чтобы не было CORS)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*', // CRM API
      },
    ];
  },
};

module.exports = nextConfig;