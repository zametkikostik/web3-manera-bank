const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { getProvider, getWallet } = require('../config/web3');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to check admin privileges
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    
    // Check if user is admin (you can implement your own admin logic)
    const userResult = await query(`
      SELECT email, wallet_address FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    
    // Check if user is admin (compare with admin wallet address)
    if (user.wallet_address !== process.env.ADMIN_WALLET_ADDRESS) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.adminUser = user;
    next();

  } catch (error) {
    logger.error('Admin check error:', error);
    res.status(500).json({ error: 'Failed to verify admin access' });
  }
};

// Apply admin middleware to all routes
router.use(requireAdmin);

// Get admin dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    // Get total users
    const usersResult = await query('SELECT COUNT(*) as total_users FROM users');
    const totalUsers = parseInt(usersResult.rows[0].total_users);

    // Get total bank accounts
    const accountsResult = await query('SELECT COUNT(*) as total_accounts FROM bank_accounts');
    const totalAccounts = parseInt(accountsResult.rows[0].total_accounts);

    // Get total balance
    const balanceResult = await query('SELECT SUM(balance) as total_balance FROM bank_accounts');
    const totalBalance = parseFloat(balanceResult.rows[0].total_balance || 0);

    // Get total transactions
    const transactionsResult = await query('SELECT COUNT(*) as total_transactions FROM transactions');
    const totalTransactions = parseInt(transactionsResult.rows[0].total_transactions);

    // Get DeFi positions
    const defiResult = await query(`
      SELECT COUNT(*) as total_positions, SUM(amount) as total_defi_value 
      FROM defi_positions WHERE status = 'active'
    `);
    const totalDefiPositions = parseInt(defiResult.rows[0].total_positions);
    const totalDefiValue = parseFloat(defiResult.rows[0].total_defi_value || 0);

    // Get bank token statistics
    const tokenResult = await query(`
      SELECT 
        SUM(balance) as total_circulation,
        SUM(burned_tokens) as total_burned,
        COUNT(*) as total_holders
      FROM bank_tokens
    `);
    const tokenStats = tokenResult.rows[0];

    // Get recent activity
    const recentActivityResult = await query(`
      SELECT t.*, u.first_name, u.last_name, u.email
      FROM transactions t
      LEFT JOIN bank_accounts ba ON (t.from_account_id = ba.id OR t.to_account_id = ba.id)
      LEFT JOIN users u ON ba.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    res.json({
      overview: {
        totalUsers,
        totalAccounts,
        totalBalance,
        totalTransactions,
        totalDefiPositions,
        totalDefiValue
      },
      tokenStats: {
        totalCirculation: parseFloat(tokenStats.total_circulation || 0),
        totalBurned: parseFloat(tokenStats.total_burned || 0),
        totalHolders: parseInt(tokenStats.total_holders || 0)
      },
      recentActivity: recentActivityResult.rows
    });

  } catch (error) {
    logger.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { limit = 100, offset = 0, search = '' } = req.query;

    let whereClause = '';
    let params = [limit, offset];

    if (search) {
      whereClause = `WHERE u.email ILIKE $3 OR u.first_name ILIKE $3 OR u.last_name ILIKE $3`;
      params.push(`%${search}%`);
    }

    const result = await query(`
      SELECT 
        u.id, u.uuid, u.email, u.first_name, u.last_name, u.phone,
        u.kyc_status, u.wallet_address, u.created_at,
        ba.balance, ba.account_number,
        bt.balance as token_balance
      FROM users u
      LEFT JOIN bank_accounts ba ON u.id = ba.user_id
      LEFT JOIN bank_tokens bt ON u.id = bt.user_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `, params);

    res.json({
      users: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get all transactions
router.get('/transactions', async (req, res) => {
  try {
    const { limit = 100, offset = 0, status = '', type = '' } = req.query;

    let whereConditions = [];
    let params = [limit, offset];
    let paramIndex = 3;

    if (status) {
      whereConditions.push(`t.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (type) {
      whereConditions.push(`t.transaction_type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(`
      SELECT 
        t.*,
        u1.first_name as from_user_first_name,
        u1.last_name as from_user_last_name,
        u1.email as from_user_email,
        u2.first_name as to_user_first_name,
        u2.last_name as to_user_last_name,
        u2.email as to_user_email
      FROM transactions t
      LEFT JOIN bank_accounts ba1 ON t.from_account_id = ba1.id
      LEFT JOIN users u1 ON ba1.user_id = u1.id
      LEFT JOIN bank_accounts ba2 ON t.to_account_id = ba2.id
      LEFT JOIN users u2 ON ba2.user_id = u2.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $1 OFFSET $2
    `, params);

    res.json({
      transactions: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    logger.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Withdraw funds to admin wallet
router.post('/withdraw', [
  body('amount').isDecimal(),
  body('currency').isIn(['BGN', 'EUR', 'USD', 'ETH', 'BTC']),
  body('walletAddress').isEthereumAddress(),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
  }

    const { amount, currency, walletAddress, description = 'Admin withdrawal' } = req.body;
    const adminUserId = req.user.userId;

    // Get total available balance for the currency
    const balanceResult = await query(`
      SELECT SUM(balance) as total_balance 
      FROM bank_accounts 
      WHERE currency = $1
    `, [currency]);

    const totalBalance = parseFloat(balanceResult.rows[0].total_balance || 0);
    const withdrawAmount = parseFloat(amount);

    if (totalBalance < withdrawAmount) {
      return res.status(400).json({ 
        error: 'Insufficient funds',
        available: totalBalance,
        requested: withdrawAmount
      });
    }

    // Get admin wallet
    const adminWallet = getWallet(process.env.ADMIN_PRIVATE_KEY);
    const provider = getProvider('ethereum');

    let txHash = '';

    if (currency === 'ETH') {
      // Send ETH transaction
      const tx = await adminWallet.sendTransaction({
        to: walletAddress,
        value: ethers.parseEther(amount.toString())
      });
      txHash = tx.hash;
    } else if (currency === 'BTC') {
      // For BTC, you would need to implement Bitcoin transaction
      // This is a placeholder
      txHash = 'btc_transaction_placeholder';
    } else {
      // For fiat currencies, this would be a bank transfer
      // This is a placeholder for bank transfer
      txHash = 'bank_transfer_placeholder';
    }

    // Log admin withdrawal
    await query(`
      INSERT INTO transactions (from_account_id, amount, currency, transaction_type, status, description, blockchain_tx_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [null, withdrawAmount, currency, 'admin_withdrawal', 'completed', description, txHash]);

    // Update balances (distribute withdrawal across accounts)
    const accountsResult = await query(`
      SELECT id, balance FROM bank_accounts WHERE currency = $1 ORDER BY balance DESC
    `, [currency]);

    let remainingAmount = withdrawAmount;
    
    for (const account of accountsResult.rows) {
      if (remainingAmount <= 0) break;
      
      const accountBalance = parseFloat(account.balance);
      const deductAmount = Math.min(accountBalance, remainingAmount);
      
      await query(`
        UPDATE bank_accounts 
        SET balance = balance - $1, available_balance = available_balance - $1
        WHERE id = $2
      `, [deductAmount, account.id]);
      
      remainingAmount -= deductAmount;
    }

    logger.info(`Admin withdrawal: ${amount} ${currency} to ${walletAddress}`);

    res.json({
      message: 'Withdrawal completed successfully',
      amount: withdrawAmount,
      currency,
      walletAddress,
      transactionHash: txHash
    });

  } catch (error) {
    logger.error('Admin withdrawal error:', error);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

// Get withdrawal history
router.get('/withdrawals', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await query(`
      SELECT * FROM transactions 
      WHERE transaction_type = 'admin_withdrawal'
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      withdrawals: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    logger.error('Get withdrawals error:', error);
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

// Update bank settings
router.post('/settings', [
  body('key').notEmpty(),
  body('value').notEmpty(),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { key, value, description } = req.body;

    await query(`
      INSERT INTO admin_settings (key, value, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        description = EXCLUDED.description,
        updated_at = CURRENT_TIMESTAMP
    `, [key, value, description]);

    logger.info(`Admin setting updated: ${key} = ${value}`);

    res.json({
      message: 'Setting updated successfully',
      key,
      value
    });

  } catch (error) {
    logger.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Get bank settings
router.get('/settings', async (req, res) => {
  try {
    const result = await query(`
      SELECT key, value, description, updated_at
      FROM admin_settings
      ORDER BY key
    `);

    res.json({
      settings: result.rows
    });

  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get system health
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbCheck = await query('SELECT NOW() as db_time');
    
    // Check Redis connection
    const redis = require('redis');
    const redisClient = redis.createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();
    const redisCheck = await redisClient.ping();
    await redisClient.disconnect();

    // Check Web3 providers
    const { getProvider } = require('../config/web3');
    const ethereumProvider = getProvider('ethereum');
    const ethereumBlock = await ethereumProvider.getBlockNumber();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: 'connected',
          responseTime: Date.now() - new Date(dbCheck.rows[0].db_time).getTime()
        },
        redis: {
          status: redisCheck === 'PONG' ? 'connected' : 'disconnected'
        },
        ethereum: {
          status: 'connected',
          latestBlock: ethereumBlock
        }
      }
    });

  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message 
    });
  }
});

module.exports = router;