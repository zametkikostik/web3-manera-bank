const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

const router = express.Router();

// Bybit API configuration
const BYBIT_BASE_URL = 'https://api.bybit.com';
const BYBIT_TESTNET_URL = 'https://api-testnet.bybit.com';

// Generate Bybit signature
const generateBybitSignature = (params, secret) => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  return crypto
    .createHmac('sha256', secret)
    .update(sortedParams)
    .digest('hex');
};

// Get market data from Bybit
router.get('/bybit/market-data', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT' } = req.query;

    const response = await axios.get(`${BYBIT_BASE_URL}/v5/market/tickers`, {
      params: { category: 'spot', symbol }
    });

    res.json({
      symbol,
      data: response.data.result.list[0]
    });

  } catch (error) {
    logger.error('Bybit market data error:', error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// Get account balance from Bybit
router.get('/bybit/balance', async (req, res) => {
  try {
    const userId = req.user.userId;
    const timestamp = Date.now().toString();

    // Get user's API credentials (stored encrypted)
    const userResult = await query(`
      SELECT bybit_api_key, bybit_secret_key FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0 || !userResult.rows[0].bybit_api_key) {
      return res.status(404).json({ error: 'Bybit API credentials not found' });
    }

    const { bybit_api_key, bybit_secret_key } = userResult.rows[0];

    const params = {
      accountType: 'UNIFIED',
      timestamp: timestamp
    };

    const signature = generateBybitSignature(params, bybit_secret_key);

    const response = await axios.get(`${BYBIT_BASE_URL}/v5/account/wallet-balance`, {
      params,
      headers: {
        'X-BAPI-API-KEY': bybit_api_key,
        'X-BAPI-SIGN': signature,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': '5000'
      }
    });

    res.json({
      balance: response.data.result.list[0]
    });

  } catch (error) {
    logger.error('Bybit balance error:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// Place order on Bybit
router.post('/bybit/place-order', [
  body('symbol').notEmpty(),
  body('side').isIn(['Buy', 'Sell']),
  body('orderType').isIn(['Market', 'Limit']),
  body('qty').isDecimal(),
  body('price').optional().isDecimal()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { symbol, side, orderType, qty, price } = req.body;
    const userId = req.user.userId;
    const timestamp = Date.now().toString();

    // Get user's API credentials
    const userResult = await query(`
      SELECT bybit_api_key, bybit_secret_key FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0 || !userResult.rows[0].bybit_api_key) {
      return res.status(404).json({ error: 'Bybit API credentials not found' });
    }

    const { bybit_api_key, bybit_secret_key } = userResult.rows[0];

    const params = {
      category: 'spot',
      symbol,
      side,
      orderType,
      qty,
      timestamp: timestamp
    };

    if (orderType === 'Limit' && price) {
      params.price = price;
    }

    const signature = generateBybitSignature(params, bybit_secret_key);

    const response = await axios.post(`${BYBIT_BASE_URL}/v5/order/create`, params, {
      headers: {
        'X-BAPI-API-KEY': bybit_api_key,
        'X-BAPI-SIGN': signature,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': '5000'
      }
    });

    // Save order to database
    await query(`
      INSERT INTO exchange_orders (user_id, exchange, symbol, side, amount, price, order_type, status, exchange_order_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [userId, 'bybit', symbol, side.toLowerCase(), qty, price || null, orderType.toLowerCase(), 'pending', response.data.result.orderId]);

    res.json({
      orderId: response.data.result.orderId,
      symbol,
      side,
      orderType,
      qty,
      price
    });

  } catch (error) {
    logger.error('Bybit place order error:', error);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// Get order history from Bybit
router.get('/bybit/orders', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 50, offset = 0 } = req.query;

    const result = await query(`
      SELECT * FROM exchange_orders 
      WHERE user_id = $1 AND exchange = 'bybit'
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    res.json({
      orders: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    logger.error('Get Bybit orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Connect Bybit API
router.post('/bybit/connect', [
  body('apiKey').notEmpty(),
  body('secretKey').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { apiKey, secretKey } = req.body;
    const userId = req.user.userId;

    // Test API credentials
    const timestamp = Date.now().toString();
    const params = { timestamp };
    const signature = generateBybitSignature(params, secretKey);

    try {
      await axios.get(`${BYBIT_BASE_URL}/v5/account/wallet-balance`, {
        params,
        headers: {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-SIGN': signature,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': '5000'
        }
      });
    } catch (error) {
      return res.status(400).json({ error: 'Invalid API credentials' });
    }

    // Store encrypted credentials
    const crypto = require('crypto');
    const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
    let encryptedApiKey = cipher.update(apiKey, 'utf8', 'hex');
    encryptedApiKey += cipher.final('hex');

    const cipher2 = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
    let encryptedSecretKey = cipher2.update(secretKey, 'utf8', 'hex');
    encryptedSecretKey += cipher2.final('hex');

    await query(`
      UPDATE users 
      SET bybit_api_key = $1, bybit_secret_key = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [encryptedApiKey, encryptedSecretKey, userId]);

    logger.info(`Bybit API connected for user ${userId}`);

    res.json({ message: 'Bybit API connected successfully' });

  } catch (error) {
    logger.error('Connect Bybit API error:', error);
    res.status(500).json({ error: 'Failed to connect Bybit API' });
  }
});

// Get trading pairs
router.get('/pairs', async (req, res) => {
  try {
    const { exchange = 'bybit' } = req.query;

    let pairs = [];

    if (exchange === 'bybit') {
      const response = await axios.get(`${BYBIT_BASE_URL}/v5/market/instruments-info`, {
        params: { category: 'spot' }
      });

      pairs = response.data.result.list
        .filter(item => item.status === 'Trading')
        .map(item => ({
          symbol: item.symbol,
          baseAsset: item.baseCoin,
          quoteAsset: item.quoteCoin,
          minOrderQty: item.lotSizeFilter.minOrderQty,
          maxOrderQty: item.lotSizeFilter.maxOrderQty,
          tickSize: item.priceFilter.tickSize
        }));
    }

    res.json({ pairs, exchange });

  } catch (error) {
    logger.error('Get trading pairs error:', error);
    res.status(500).json({ error: 'Failed to fetch trading pairs' });
  }
});

// Get price history
router.get('/price-history', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT', interval = '1h', limit = 100 } = req.query;

    const response = await axios.get(`${BYBIT_BASE_URL}/v5/market/kline`, {
      params: {
        category: 'spot',
        symbol,
        interval,
        limit
      }
    });

    res.json({
      symbol,
      interval,
      data: response.data.result.list
    });

  } catch (error) {
    logger.error('Get price history error:', error);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

// Get exchange statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.userId;

    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN side = 'buy' THEN amount ELSE 0 END) as total_buy_volume,
        SUM(CASE WHEN side = 'sell' THEN amount ELSE 0 END) as total_sell_volume
      FROM exchange_orders 
      WHERE user_id = $1
    `, [userId]);

    const stats = statsResult.rows[0];

    res.json({
      totalOrders: parseInt(stats.total_orders),
      completedOrders: parseInt(stats.completed_orders),
      pendingOrders: parseInt(stats.pending_orders),
      totalBuyVolume: parseFloat(stats.total_buy_volume || 0),
      totalSellVolume: parseFloat(stats.total_sell_volume || 0),
      successRate: stats.total_orders > 0 ? 
        ((stats.completed_orders / stats.total_orders) * 100).toFixed(2) : 0
    });

  } catch (error) {
    logger.error('Get exchange stats error:', error);
    res.status(500).json({ error: 'Failed to fetch exchange statistics' });
  }
});

module.exports = router;