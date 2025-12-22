// backend/testConnection.js
const pool = require('./config/db');

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error executing query', err.stack);
  } else {
    console.log('PostgreSQL time:', res.rows[0]);
  }
  pool.end();
});
