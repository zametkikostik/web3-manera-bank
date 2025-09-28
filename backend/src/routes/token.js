const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { getProvider, getWallet, decryptPrivateKey } = require('../config/web3');
const logger = require('../utils/logger');

const router = express.Router();

// Get user's bank token balance
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(`
      SELECT balance, burned_tokens, earned_tokens, created_at, updated_at
      FROM bank_tokens
      WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Token account not found' });
    }

    const tokenData = result.rows[0];

    res.json({
      balance: parseFloat(tokenData.balance),
      burnedTokens: parseFloat(tokenData.burned_tokens),
      earnedTokens: parseFloat(tokenData.earned_tokens),
      totalSupply: process.env.BANK_TOKEN_TOTAL_SUPPLY || '1000000000',
      symbol: process.env.BANK_TOKEN_SYMBOL || 'MNR',
      name: process.env.BANK_TOKEN_NAME || 'MoneraToken'
    });

  } catch (error) {
    logger.error('Get token balance error:', error);
    res.status(500).json({ error: 'Failed to fetch token balance' });
  }
});

// Get token transaction history
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 50, offset = 0 } = req.query;

    const result = await query(`
      SELECT 
        t.uuid,
        t.amount,
        t.currency,
        t.transaction_type,
        t.status,
        t.description,
        t.fee,
        t.created_at,
        CASE 
          WHEN t.from_account_id = ba.id THEN 'sent'
          WHEN t.to_account_id = ba.id THEN 'received'
          ELSE 'other'
        END as direction
      FROM transactions t
      JOIN bank_accounts ba ON (t.from_account_id = ba.id OR t.to_account_id = ba.id)
      WHERE ba.user_id = $1 AND t.currency = $2
      ORDER BY t.created_at DESC
      LIMIT $3 OFFSET $4
    `, [userId, process.env.BANK_TOKEN_SYMBOL || 'MNR', limit, offset]);

    res.json({
      transactions: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    logger.error('Get token history error:', error);
    res.status(500).json({ error: 'Failed to fetch token history' });
  }
});

// Burn tokens (happens automatically on transactions)
router.post('/burn', [
  body('amount').isDecimal(),
  body('transactionId').optional().isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, transactionId } = req.body;
    const userId = req.user.userId;

    // Get current balance
    const balanceResult = await query(`
      SELECT balance FROM bank_tokens WHERE user_id = $1
    `, [userId]);

    if (balanceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Token account not found' });
    }

    const currentBalance = parseFloat(balanceResult.rows[0].balance);
    const burnAmount = parseFloat(amount);

    if (currentBalance < burnAmount) {
      return res.status(400).json({ error: 'Insufficient token balance' });
    }

    // Update balance and burned tokens
    await query(`
      UPDATE bank_tokens 
      SET balance = balance - $1, burned_tokens = burned_tokens + $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
    `, [burnAmount, userId]);

    // Log burn transaction
    await query(`
      INSERT INTO transactions (from_account_id, amount, currency, transaction_type, status, description, fee)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [null, burnAmount, process.env.BANK_TOKEN_SYMBOL || 'MNR', 'burn', 'completed', 'Token burn', 0]);

    logger.info(`Tokens burned: ${burnAmount} MNR for user ${userId}`);

    res.json({
      message: 'Tokens burned successfully',
      amount: burnAmount,
      transactionId: transactionId
    });

  } catch (error) {
    logger.error('Burn tokens error:', error);
    res.status(500).json({ error: 'Failed to burn tokens' });
  }
});

// Earn tokens (from fees and rewards)
router.post('/earn', [
  body('amount').isDecimal(),
  body('source').isIn(['transaction_fee', 'referral', 'staking', 'liquidity_provision', 'admin_reward'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, source } = req.body;
    const userId = req.user.userId;

    // Update balance and earned tokens
    await query(`
      UPDATE bank_tokens 
      SET balance = balance + $1, earned_tokens = earned_tokens + $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `, [amount, userId]);

    // Log earn transaction
    await query(`
      INSERT INTO transactions (to_account_id, amount, currency, transaction_type, status, description, fee)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [userId, amount, process.env.BANK_TOKEN_SYMBOL || 'MNR', 'earn', 'completed', `Token earned from ${source}`, 0]);

    logger.info(`Tokens earned: ${amount} MNR from ${source} for user ${userId}`);

    res.json({
      message: 'Tokens earned successfully',
      amount: amount,
      source: source
    });

  } catch (error) {
    logger.error('Earn tokens error:', error);
    res.status(500).json({ error: 'Failed to earn tokens' });
  }
});

// Get token statistics
router.get('/stats', async (req, res) => {
  try {
    // Get total supply and circulation
    const totalSupply = parseInt(process.env.BANK_TOKEN_TOTAL_SUPPLY || '1000000000');
    
    const statsResult = await query(`
      SELECT 
        SUM(balance) as total_circulation,
        SUM(burned_tokens) as total_burned,
        SUM(earned_tokens) as total_earned,
        COUNT(*) as total_holders
      FROM bank_tokens
    `);

    const stats = statsResult.rows[0];
    const burnedPercentage = (parseFloat(stats.total_burned) / totalSupply) * 100;
    const circulationPercentage = (parseFloat(stats.total_circulation) / totalSupply) * 100;

    // Get recent burn rate
    const burnRateResult = await query(`
      SELECT 
        DATE(created_at) as date,
        SUM(amount) as daily_burn
      FROM transactions 
      WHERE transaction_type = 'burn' AND currency = $1
      AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [process.env.BANK_TOKEN_SYMBOL || 'MNR']);

    res.json({
      totalSupply,
      totalCirculation: parseFloat(stats.total_circulation),
      totalBurned: parseFloat(stats.total_burned),
      totalEarned: parseFloat(stats.total_earned),
      totalHolders: parseInt(stats.total_holders),
      burnedPercentage: parseFloat(burnedPercentage.toFixed(2)),
      circulationPercentage: parseFloat(circulationPercentage.toFixed(2)),
      recentBurnRate: burnRateResult.rows
    });

  } catch (error) {
    logger.error('Get token stats error:', error);
    res.status(500).json({ error: 'Failed to fetch token statistics' });
  }
});

// Transfer tokens to another user
router.post('/transfer', [
  body('toUserId').isInt(),
  body('amount').isDecimal(),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { toUserId, amount, description = 'Token transfer' } = req.body;
    const fromUserId = req.user.userId;

    if (fromUserId === toUserId) {
      return res.status(400).json({ error: 'Cannot transfer to yourself' });
    }

    // Check if recipient exists
    const recipientResult = await query('SELECT id FROM users WHERE id = $1', [toUserId]);
    if (recipientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Check sender balance
    const senderBalanceResult = await query(`
      SELECT balance FROM bank_tokens WHERE user_id = $1
    `, [fromUserId]);

    if (senderBalanceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sender token account not found' });
    }

    const senderBalance = parseFloat(senderBalanceResult.rows[0].balance);
    const transferAmount = parseFloat(amount);

    if (senderBalance < transferAmount) {
      return res.status(400).json({ error: 'Insufficient token balance' });
    }

    // Get accounts for transaction
    const fromAccountResult = await query(`
      SELECT id FROM bank_accounts WHERE user_id = $1 LIMIT 1
    `, [fromUserId]);

    const toAccountResult = await query(`
      SELECT id FROM bank_accounts WHERE user_id = $1 LIMIT 1
    `, [toUserId]);

    if (fromAccountResult.rows.length === 0 || toAccountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bank accounts not found' });
    }

    // Calculate burn amount (percentage of transaction)
    const burnRate = parseFloat(process.env.BANK_TOKEN_BURN_RATE || '0.1');
    const burnAmount = transferAmount * (burnRate / 100);
    const netTransferAmount = transferAmount - burnAmount;

    // Start transaction
    const client = await query.getPool().connect();
    await client.query('BEGIN');

    try {
      // Update sender balance
      await client.query(`
        UPDATE bank_tokens 
        SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `, [transferAmount, fromUserId]);

      // Update recipient balance
      await client.query(`
        UPDATE bank_tokens 
        SET balance = balance + $1, earned_tokens = earned_tokens + $1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `, [netTransferAmount, toUserId]);

      // Record transfer transaction
      await client.query(`
        INSERT INTO transactions (from_account_id, to_account_id, amount, currency, transaction_type, status, description, fee)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        fromAccountResult.rows[0].id,
        toAccountResult.rows[0].id,
        netTransferAmount,
        process.env.BANK_TOKEN_SYMBOL || 'MNR',
        'transfer',
        'completed',
        description,
        burnAmount
      ]);

      // Record burn transaction
      if (burnAmount > 0) {
        await client.query(`
          INSERT INTO transactions (from_account_id, amount, currency, transaction_type, status, description, fee)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          fromAccountResult.rows[0].id,
          burnAmount,
          process.env.BANK_TOKEN_SYMBOL || 'MNR',
          'burn',
          'completed',
          'Automatic token burn',
          0
        ]);
      }

      await client.query('COMMIT');

      logger.info(`Token transfer: ${transferAmount} MNR from user ${fromUserId} to user ${toUserId}, burned: ${burnAmount}`);

      res.json({
        message: 'Token transfer completed successfully',
        amount: netTransferAmount,
        burned: burnAmount,
        description
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Token transfer error:', error);
    res.status(500).json({ error: 'Failed to transfer tokens' });
  }
});

// Get token leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const result = await query(`
      SELECT 
        u.first_name,
        u.last_name,
        bt.balance,
        bt.earned_tokens,
        bt.burned_tokens,
        RANK() OVER (ORDER BY bt.balance DESC) as rank
      FROM bank_tokens bt
      JOIN users u ON bt.user_id = u.id
      ORDER BY bt.balance DESC
      LIMIT $1
    `, [limit]);

    res.json({
      leaderboard: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    logger.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;