const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Map role IDs to role names
const rolesMap = {
  1: 'Admin',
  2: 'Tutor',
  3: 'Manager',
  4: 'Student',
  5: 'Moderator'
};

// ----------------------
// Register a new user (Admin can create users)
// ----------------------
exports.register = async (req, res) => {
  try {
    const { name, email, password, role_id, manager_id } = req.body;

    if (!name || !email || !password || !role_id) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await User.create({
      name,
      email,
      passwordHash: hashedPassword, // <--- fixed here 
      role_id,
      manager_id: manager_id || null
    });

    res.status(201).json({ message: 'User created', userId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// ----------------------
// Login route
// ----------------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findByEmail(email);
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // Compare password with hashed password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, name: user.name, role_id: user.role_id },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: rolesMap[user.role_id], // <--- send readable role
        manager_id: user.manager_id || null
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
