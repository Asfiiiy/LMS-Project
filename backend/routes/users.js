const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // MySQL pool
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { findUserForLogin } = require('../utils/emailLoginLookup');

// Secret key for JWT (store in .env in production)
const JWT_SECRET = process.env.JWT_SECRET;

// Map role_id to role string
const rolesMap = {
  1: 'Admin',
  2: 'Assessor',
  3: 'Manager',
  4: 'Student',
  5: 'Moderator',
  6: 'Operation Manager',
  7: 'Accounts Manager',
  8: 'Administrative Manager',
  9: 'Admission Manager',
  10: 'Team Member',
  11: 'Certificate Manager',
  12: 'ManagerStudent',
  13: 'InstituteStudent',
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

    // Insert into database
    const query = `
      INSERT INTO users (name, email, password_hash, role_id, manager_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(query, [name, email, hashedPassword, role_id, manager_id || null]);

    // Fetch the inserted user
    const [rows] = await pool.execute(
      'SELECT id, name, email, role_id, manager_id, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    const user = rows[0];
    user.role = rolesMap[user.role_id]; // Map role_id to role string

    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ----------------------
// Login route
// ----------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Exact match, then Gmail/GoogleMail dot- and plus-tag–insensitive match
    const user = await findUserForLogin(pool, email);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Compare password with hashed password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, name: user.name, role: rolesMap[user.role_id] },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: rolesMap[user.role_id], // Return role string for frontend
        manager_id: user.manager_id,
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ----------------------
// Get all users (Admin only)
// ----------------------
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name, email, role_id, manager_id FROM users ORDER BY id ASC');

    // Map role_id to role string
    const users = rows.map((u) => ({
      ...u,
      role: rolesMap[u.role_id],
    }));

    res.json({ success: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
