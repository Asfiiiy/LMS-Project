const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_lms',

  // 4 PM2 cluster workers × 25 = 100 max — under typical MySQL default max_connections (151)
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '25', 10),
  queueLimit: 100,
  maxIdle: 15,
  idleTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000,

  // ✅ IMPROVED PERFORMANCE SETTINGS
  multipleStatements: false,
  dateStrings: true,             // ✅ CHANGED: false → true (better date handling)
  supportBigNumbers: true,
  bigNumberStrings: false,
  charset: 'utf8mb4',            // ✅ ADDED: For emoji support
  timezone: 'Z',                 // ✅ ADDED: UTC timezone

  // SSL (if using remote database)
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
});

// Connection pool monitoring
pool.on('acquire', (connection) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Connection ${connection.threadId} acquired`);
  }
});

pool.on('release', (connection) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Connection ${connection.threadId} released`);
  }
});

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message);
  // Don't crash the app
});

// Test connection with retry logic
const testConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await pool.getConnection();
      // startup log - safe to keep
      console.log(`✅ MySQL connected successfully! (Thread ID: ${conn.threadId})`);
      conn.release();
      return;
    } catch (err) {
      if (i === retries - 1) {
        console.error(`❌ MySQL connection failed after ${retries} attempts:`, err.message);
        console.log('⚠️ Server continues running - connections will be established on demand.');
      } else {
        console.log(`⏳ MySQL connection attempt ${i + 1} failed, retrying in 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
};

// Non-blocking connection test
setTimeout(() => {
  testConnection();
}, 1000);

module.exports = pool;

