/** @type {import('next').NextConfig} */
const nextConfig = {
  // ============================================================
  // 1. ИЗОБРАЖЕНИЯ
  // ============================================================
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
    minimumCacheTTL: 86400, // ✅ 24 ЧАСА
    formats: ['image/webp'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // ============================================================
  // 2. PROXY (УЖЕ ЕСТЬ)
  // ============================================================
  async rewrites() {
    return [
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
      {
        source: '/api/:path*',
        destination: 'http://localhost:5001/api/:path*',
      },
      {
        source: '/api/crm/:path*',
        destination: 'http://localhost:5000/api/:path*',
      },
    ];
  },

  // ============================================================
  // 3. ✅ СЖАТИЕ И КЭШИРОВАНИЕ СТАТИКИ
  // ============================================================
  compress: true,
  
  // ============================================================
  // 4. ✅ КЭШИРОВАНИЕ СТРАНИЦ
  // ============================================================
  swcMinify: true,
  
  experimental: {
    optimizeCss: true,
    // ✅ Включаем предзагрузку данных
    optimisticClientCache: true,
  },

  // ============================================================
  // 5. ✅ ДОЛГОЕ КЭШИРОВАНИЕ БИЛДА
  // ============================================================
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },

  // ============================================================
  // 6. ✅ УСКОРЕНИЕ СБОРКИ
  // ============================================================
  poweredByHeader: false,
  reactStrictMode: true,
  
  webpack: (config, { isServer }) => {
    // ✅ Ускорение сборки
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },

  // ============================================================
  // 7. ✅ HTTP/2 PUSH (для статики)
  // ============================================================
  headers: async () => {
    return [
      {
        source: '/:path*.{css,js,woff,woff2}',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;