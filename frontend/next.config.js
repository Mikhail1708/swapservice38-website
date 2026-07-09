/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'localhost',
      '127.0.0.1',
      'swapcrm.ru',
      'www.swapcrm.ru',
    ],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5173',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5001',
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
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    formats: ['image/webp'],
  },

  async rewrites() {
    return [
      // ✅ Прокси для сайтового бэкенда (порт 5001)
      {
        source: '/api/auth/:path*',
        destination: 'http://localhost:5001/api/auth/:path*',
      },
      {
        source: '/api/products/:path*',
        destination: 'http://localhost:5001/api/products/:path*',
      },
      {
        source: '/api/cart/:path*',
        destination: 'http://localhost:5001/api/cart/:path*',
      },
      {
        source: '/api/orders/:path*',
        destination: 'http://localhost:5001/api/orders/:path*',
      },
      {
        source: '/api/payment/:path*',
        destination: 'http://localhost:5001/api/payment/:path*',
      },
      {
        source: '/api/admin/:path*',
        destination: 'http://localhost:5001/api/admin/:path*',
      },
      {
        source: '/api/webhooks/:path*',
        destination: 'http://localhost:5001/api/webhooks/:path*',
      },
      // ✅ ОСТАЛЬНЫЕ API (если есть) — на сайтовый бэкенд
      {
        source: '/api/:path*',
        destination: 'http://localhost:5001/api/:path*',
      },
      // ✅ CRM API (если нужно отдельно)
       {
        source: '/api/crm/:path*',
        destination: 'http://localhost:5000/api/:path*',
       },
    ];
  },
};

module.exports = nextConfig;