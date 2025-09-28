const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const result = await query(`
      SELECT id, email, first_name, last_name, wallet_address, kyc_status, language
      FROM users WHERE id = $1
    `, [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      ...result.rows[0]
    };

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    logger.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

const requireKYC = async (req, res, next) => {
  try {
    if (req.user.kyc_status !== 'approved') {
      return res.status(403).json({ 
        error: 'KYC verification required',
        kycStatus: req.user.kyc_status
      });
    }
    next();
  } catch (error) {
    logger.error('KYC middleware error:', error);
    res.status(500).json({ error: 'KYC verification failed' });
  }
};

const requireTwoFactor = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    
    const result = await query(`
      SELECT two_factor_enabled FROM users WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!result.rows[0].two_factor_enabled) {
      return res.status(403).json({ 
        error: 'Two-factor authentication required',
        twoFactorEnabled: false
      });
    }

    // Check if 2FA token is provided
    const twoFactorToken = req.headers['x-2fa-token'];
    if (!twoFactorToken) {
      return res.status(401).json({ error: 'Two-factor token required' });
    }

    // Verify 2FA token (implement your 2FA verification logic)
    // This is a placeholder - implement proper 2FA verification
    const isValidToken = await verifyTwoFactorToken(userId, twoFactorToken);
    if (!isValidToken) {
      return res.status(401).json({ error: 'Invalid two-factor token' });
    }

    next();

  } catch (error) {
    logger.error('2FA middleware error:', error);
    res.status(500).json({ error: 'Two-factor authentication failed' });
  }
};

const verifyTwoFactorToken = async (userId, token) => {
  // Implement your 2FA verification logic here
  // This could be TOTP, SMS, or other 2FA methods
  // For now, return true as placeholder
  return true;
};

module.exports = {
  authenticateToken,
  requireKYC,
  requireTwoFactor
};