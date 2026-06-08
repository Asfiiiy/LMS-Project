/**
 * PM2 Configuration for LMS
 * User: dev749inspire
 * Resources: 8 vCPUs, 32GB RAM
 * Total CPU Target: 400% (40% of 8 cores)
 * Total Memory: 6.5GB allocated (leaves 25.5GB free)
 */

module.exports = {
  apps: [
    // ============ BACKEND SERVER ============
    {
      name: 'lms-backend',
      script: './backend/server.js',
      cwd: '/var/www/lms-app',
      instances: 4, // Increased from 2 to 4 for 200-300 concurrent users
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        INSTANCE_NUM: 0
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5001
      },
      error_file: '/var/www/lms-app/backend/logs/backend-error.log',
      out_file: '/var/www/lms-app/backend/logs/backend-out.log',
      log_file: '/var/www/lms-app/backend/logs/backend-combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1500M',
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 10000,
      watch: false,
      ignore_watch: [
        'node_modules',
        'logs',
        '.git',
        '*.log'
      ],
      kill_timeout: 8000,
      listen_timeout: 30000,
      wait_ready: true,
      instance_var: 'INSTANCE_NUM'
    },

    // ============ CERTIFICATE WORKER ============
    {
      name: 'lms-worker',
      script: './backend/workers/certificateWorker.js',
      cwd: '/var/www/lms-app',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'certificate'
      },
      error_file: '/var/www/lms-app/backend/logs/worker-error.log',
      out_file: '/var/www/lms-app/backend/logs/worker-out.log',
      log_file: '/var/www/lms-app/backend/logs/worker-combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1000M',
      min_uptime: '20s',
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      kill_timeout: 5000
    },

    // ============ FRONTEND (Next.js) ============
    {
      name: 'lms-frontend',
      script: './node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/lms-app',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
        HOSTNAME: 'localhost'
      },
      error_file: '/var/www/lms-app/backend/logs/frontend-error.log',
      out_file: '/var/www/lms-app/backend/logs/frontend-out.log',
      log_file: '/var/www/lms-app/backend/logs/frontend-combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1000M',
      min_uptime: '60s',
      max_restarts: 3,
      restart_delay: 15000,
      watch: false,
      ignore_watch: [
        'node_modules',
        '.next',
        'logs',
        '*.log'
      ],
      kill_timeout: 15000,
      listen_timeout: 20000
    }
  ]
};
