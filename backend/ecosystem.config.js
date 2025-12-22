/**
 * PM2 Ecosystem Configuration
 * 
 * This file allows PM2 to manage both the server and worker processes.
 * 
 * Installation: npm install -g pm2
 * 
 * Start both: pm2 start ecosystem.config.js
 * Stop both: pm2 stop ecosystem.config.js
 * Restart both: pm2 restart ecosystem.config.js
 * View logs: pm2 logs
 * View status: pm2 status
 * 
 * Auto-start on server reboot: pm2 startup && pm2 save
 */

/**
 * PM2 Ecosystem Configuration
 * 
 * Optimized for VPS: 8 vCPU, 32GB RAM, 400GB NVMe
 * Registered Users: 100k | Active Users: 10k-15k
 * 
 * Server instances: 5 (leaves 3 CPUs for MySQL, Redis, system)
 * Worker instances: 2 (for certificate generation)
 * 
 * Installation: npm install -g pm2
 * 
 * Start both: pm2 start ecosystem.config.js
 * Stop both: pm2 stop ecosystem.config.js
 * Restart both: pm2 restart ecosystem.config.js
 * View logs: pm2 logs
 * View status: pm2 status
 * 
 * Auto-start on server reboot: pm2 startup && pm2 save
 */

module.exports = {
  apps: [
    {
      name: 'lms-server',
      script: './server.js',
      instances: 5,               // 5 instances for 10k-15k active users (leaves 3 CPUs for system/DB)
      exec_mode: 'cluster',       // Cluster mode for load balancing
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        NODE_OPTIONS: '--max-old-space-size=3584' // 3.5GB per instance (5 instances = ~17.5GB)
      },
      error_file: './logs/server-error.log',
      out_file: './logs/server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '4G',    // Optimized for 10k-15k active users
      min_uptime: '10s',          // Minimum uptime before considering stable
      max_restarts: 10,           // Max restarts in 1 minute
      restart_delay: 4000,        // Delay between restarts
      watch: false,
      // Advanced settings
      kill_timeout: 5000,         // Time to wait for graceful shutdown
      listen_timeout: 10000,      // Time to wait for app to listen
      shutdown_with_message: true
    },
    {
      name: 'lms-worker',
      script: './workers/certificateWorker.js',
      instances: 2,               // 2 worker instances for certificate generation
      exec_mode: 'cluster',       // Cluster mode
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=1024' // 1GB per worker instance
      },
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1.2G',  // Increased for certificate processing
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      watch: false,
      kill_timeout: 5000,
      listen_timeout: 10000
    }
  ]
};

