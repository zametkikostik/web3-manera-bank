const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { createWallet, encryptPrivateKey } = require('../config/web3');
const { generateResponse } = require('../config/ai');
const logger = require('../utils/logger');

const router = express.Router();

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  body('firstName').trim().isLength({ min: 2, max: 50 }),
  body('lastName').trim().isLength({ min: 2, max: 50 }),
  body('phone').isMobilePhone(),
  body('language').optional().isIn(['bg', 'en', 'ru', 'de', 'fr', 'es'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, phone, language = 'bg' } = req.body;

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create wallet for user
    const wallet = createWallet();
    const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey, password);

    // Create user
    const result = await query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, wallet_address, private_key_encrypted, language)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, uuid, email, first_name, last_name, wallet_address, created_at
    `, [email, passwordHash, firstName, lastName, phone, wallet.address, encryptedPrivateKey, language]);

    const user = result.rows[0];

    // Create default bank account
    const accountNumber = `MNR${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    await query(`
      INSERT INTO bank_accounts (user_id, account_number, iban, currency)
      VALUES ($1, $2, $3, $4)
    `, [user.id, accountNumber, `BG80BNBG96611020345678${accountNumber}`, 'BGN']);

    // Create bank token account
    await query(`
      INSERT INTO bank_tokens (user_id, balance, earned_tokens)
      VALUES ($1, $2, $3)
    `, [user.id, 0, 0]);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        walletAddress: user.wallet_address,
        language: language
      },
      token
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const result = await query(`
      SELECT id, uuid, email, password_hash, first_name, last_name, wallet_address, 
             two_factor_enabled, kyc_status, language
      FROM users WHERE email = $1
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Update last login
    await query('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    logger.info(`User logged in: ${email}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        walletAddress: user.wallet_address,
        twoFactorEnabled: user.two_factor_enabled,
        kycStatus: user.kyc_status,
        language: user.language
      },
      token
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI Chat endpoint
router.post('/chat', [
  body('message').notEmpty().trim(),
  body('sessionId').optional().isUUID()
], async (req, res) => {
  try {
    const { message, sessionId = req.sessionID } = req.body;
    const userId = req.user?.userId;

    // Generate AI response
    const aiResponse = await generateResponse(message);

    // Save conversation to database if user is logged in
    if (userId) {
      await query(`
        INSERT INTO ai_conversations (user_id, session_id, message, response, ai_model, tokens_used)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [userId, sessionId, message, aiResponse.content, aiResponse.model, aiResponse.tokens]);
    }

    res.json({
      response: aiResponse.content,
      model: aiResponse.model,
      tokens: aiResponse.tokens
    });

  } catch (error) {
    logger.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Forgot password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const { email } = req.body;

    const result = await query('SELECT id, first_name FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: result.rows[0].id, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // TODO: Send email with reset link
    logger.info(`Password reset requested for: ${email}, token: ${resetToken}`);

    res.json({ message: 'Password reset instructions sent to your email' });

  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password
router.post('/reset-password', [
  body('token').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
], async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ error: 'Invalid token' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', 
      [passwordHash, decoded.userId]);

    logger.info(`Password reset for user ID: ${decoded.userId}`);

    res.json({ message: 'Password reset successfully' });

  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;