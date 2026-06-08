/**
 * Idempotent: safe to run multiple times.
 * Uses backend/.env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'db_lms',
    multipleStatements: false
  });

  console.log('Connected to', process.env.DB_NAME || 'db_lms');

  // 1) Role (matches migrations/add_consultation_manager_role.sql)
  await conn.execute(
    `INSERT INTO roles (name)
     SELECT 'Consultation Manager'
     WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Consultation Manager')`
  );
  const [roleRows] = await conn.execute(
    "SELECT id, name FROM roles WHERE name = 'Consultation Manager' LIMIT 1"
  );
  console.log('Consultation Manager role:', roleRows[0] || 'not found');

  // 2) Settings table + seed (matches migrations/add_consultation_manager_settings.sql)
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS consultation_manager_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        is_enabled TINYINT(1) NOT NULL DEFAULT 1,
        disabled_message TEXT NOT NULL,
        updated_by INT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Table consultation_manager_settings: OK (with FK)');
  } catch (e) {
    console.warn('Create with FK failed:', e.message);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS consultation_manager_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        is_enabled TINYINT(1) NOT NULL DEFAULT 1,
        disabled_message TEXT NOT NULL,
        updated_by INT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Table consultation_manager_settings: OK (without FK fallback)');
  }

  await conn.execute(
    `INSERT IGNORE INTO consultation_manager_settings (id, is_enabled, disabled_message) VALUES (
      1,
      1,
      'The Consultation Manager portal is currently offline. Please check back later or contact your administrator.'
    )`
  );
  const [settingsRows] = await conn.execute(
    'SELECT id, is_enabled, LEFT(disabled_message, 60) AS msg_preview FROM consultation_manager_settings WHERE id = 1'
  );
  console.log('consultation_manager_settings row id=1:', settingsRows[0]);

  await conn.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Migration failed:', err.message || err);
  process.exit(1);
});
