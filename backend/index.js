const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = 3001;

// ── Middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// ── Health Check ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'BeautifyAI Backend is running ✅' });
});

// ── POST /api/signup ──────────────────────────────────────────────────
app.post('/api/signup', async (req, res) => {
  const { name = '', email, password } = req.body;

  // Validation
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  // Check if email already exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }

  // Hash the password with bcrypt (12 rounds)
  const password_hash = await bcrypt.hash(password, 12);

  // Insert new user
  const stmt = db.prepare(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
  );
  const result = stmt.run(name.trim(), email.toLowerCase().trim(), password_hash);

  console.log(`✅ New user signed up: ${email}`);

  return res.status(201).json({
    success: true,
    message: 'Account created successfully!',
    user: { id: result.lastInsertRowid, email: email.toLowerCase().trim(), name: name.trim() },
  });
});

// ── POST /api/login ───────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  // Look up user by email
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) {
    console.log(`❌ Login failed – email not found: ${email}`);
    return res.status(401).json({ success: false, message: 'No account found with this email. Please sign up first.' });
  }

  // Compare password against stored hash
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    console.log(`❌ Login failed – wrong password for: ${email}`);
    return res.status(401).json({ success: false, message: 'Invalid credentials. Please check your password. ❌' });
  }

  console.log(`✅ User logged in: ${email}`);

  return res.json({
    success: true,
    message: 'Login successful!',
    user: { id: user.id, email: user.email, name: user.name },
  });
});

// ── Start Server ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 BeautifyAI Backend running at http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
