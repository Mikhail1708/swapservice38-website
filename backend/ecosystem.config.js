module.exports = {
  apps: [
    {
      name: 'swapservice-api',
      script: './src/server.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      instances: 1, // Пока 1, потом попробуем max
      exec_mode: 'fork', // Пока fork, потом cluster
      env: {
        NODE_ENV: 'development',
        PORT: 5001
      },
      autorestart: true,
      max_memory_restart: '1G',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      time: true,
      kill_timeout: 5000,
      listen_timeout: 5000,
    }
  ]
};