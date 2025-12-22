// backend/config/db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_lms',
  
  // Connection Pool Settings (Optimized for 10k-15k active users)
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_SIZE || '250', 10), // Optimized for 10k-15k active users
  queueLimit: 0,                // unlimited queue (recommended)
  maxIdle: 50,                  // Increased for better connection reuse
  idleTimeout: 300000,          // 5 minutes (increased from 1 minute)
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,

  // Timeout Settings
  connectTimeout: 10000,        // timeout for initial connection
  acquireTimeout: 60000,        // timeout for getting connection from pool

  // Performance Settings
  multipleStatements: false,
  dateStrings: false,
  supportBigNumbers: true,
  bigNumberStrings: false,

  // SSL (if using remote database)
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
});

// Connection pool monitoring
if (process.env.NODE_ENV !== 'production') {
  pool.on('connection', (connection) => {
    console.log(`New connection established: ${connection.threadId}`);
  });
}

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

// Test connection (non-blocking)
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connected successfully!');
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection error:', err.message);
    console.log('⚠️ Server continues running.');
  }
})();

module.exports = pool;  