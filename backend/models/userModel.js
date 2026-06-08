const db = require('../config/db');

class User {
  // Create a new user
  static async create({ name, email, passwordHash, role_id, manager_id = null }) {
    const [result] = await db.execute(
      `INSERT INTO users (name, email, password_hash, role_id, manager_id)
       VALUES (?, ?, ?, ?, ?)`,
      [name, email, passwordHash, role_id, manager_id]
    );
    return result;
  }

  // Find user by email
  static async findByEmail(email) {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  }

  // Find user by ID
  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0];
  }

  // List all users (for admin)
  static async findAll() {
    const [rows] = await db.execute(
      'SELECT id, name, email, role_id, manager_id, created_at, updated_at FROM users ORDER BY id ASC'
    );
    return rows;
  }
}

module.exports = User;
