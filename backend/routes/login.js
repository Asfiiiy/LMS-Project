// backend/routes/users.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // MySQL pool
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { logSystemEvent, getRoleName } = require('../utils/eventLogger');

// Secret key for JWT (store in .env in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Map role IDs to role names
const rolesMap = {
  1: 'Admin',
  2: 'Tutor',
  3: 'Manager',
  4: 'Student',
  5: 'Moderator'
};

// ----------------------
// Create a new user (Admin/Tutor/Manager/Student/Moderator)
// Only Admins should call this in frontend/backend
// ----------------------
router.post('/create', async (req, res) => {
  try {
    const { name, email, password, role_id, manager_id } = req.body;

    if (!name || !email || !password || !role_id) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into database
    const query = `
      INSERT INTO users (name, email, password_hash, role_id, manager_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(query, [name, email, hashedPassword, role_id, manager_id || null]);

    // Fetch inserted user
    const [rows] = await pool.execute(
      'SELECT id, name, email, role_id, manager_id, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ----------------------
// Login route
// ----------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Check if user exists
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];

    if (!user) {
      // Log failed login attempt (user not found)
      setImmediate(async () => {
        await logSystemEvent({
          userId: null,
          role: null,
          action: 'user_login_failed',
          description: `Failed login attempt for email: ${email} (user not found)`,
          req
        });
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Compare provided password with hashed password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      // Log failed login attempt
      setImmediate(async () => {
        await logSystemEvent({
          userId: user.id,
          role: getRoleName(user.role_id),
          action: 'user_login_failed',
          description: `Failed login attempt for user ID: ${user.id} (${user.email})`,
          req
        });
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate JWT token (30 minutes expiration for auto-logout system)
    const token = jwt.sign(
      { id: user.id, name: user.name, role_id: user.role_id },
      JWT_SECRET,
      { expiresIn: '30m' }
    );

    // Log successful login
    setImmediate(async () => {
      await logSystemEvent({
        userId: user.id,
        role: getRoleName(user.role_id),
        action: 'user_login',
        description: `User logged in successfully: ${user.name} (${rolesMap[user.role_id] || 'Unknown'})`,
        req
      });
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role_id: user.role_id,
        manager_id: user.manager_id || null
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ----------------------
// Get all users (Admin only)
// ----------------------
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role_id, manager_id FROM users ORDER BY id ASC'
    );
    res.json({ success: true, users: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
