const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { getContract, getProvider, getWallet, decryptPrivateKey } = require('../config/web3');
const { generateResponse } = require('../config/ai');
const logger = require('../utils/logger');

const router = express.Router();

// Get DeFi positions for user
router.get('/positions', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(`
      SELECT dp.*, u.first_name, u.last_name
      FROM defi_positions dp
      JOIN users u ON dp.user_id = u.id
      WHERE dp.user_id = $1 AND dp.status = 'active'
      ORDER BY dp.created_at DESC
    `, [userId]);

    res.json({
      positions: result.rows,
      totalPositions: result.rows.length
    });

  } catch (error) {
    logger.error('Get DeFi positions error:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Supply assets to Aave
router.post('/aave/supply', [
  body('asset').notEmpty(),
  body('amount').isDecimal(),
  body('referralCode').optional().isInt({ min: 0, max: 65535 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { asset, amount, referralCode = 0 } = req.body;
    const userId = req.user.userId;

    // Get user wallet
    const userResult = await query('SELECT wallet_address, private_key_encrypted FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const wallet = getWallet(decryptPrivateKey(user.private_key_encrypted, req.body.password));

    // Get Aave contract
    const aaveContract = getContract('aave');
    if (!aaveContract) {
      return res.status(500).json({ error: 'Aave contract not available' });
    }

    // Execute supply transaction
    const tx = await aaveContract.deposit(
      asset,
      ethers.parseUnits(amount.toString(), 18),
      user.wallet_address,
      referralCode
    );

    // Save position to database
    await query(`
      INSERT INTO defi_positions (user_id, protocol, position_type, asset, amount, tx_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, 'aave', 'supply', asset, amount, tx.hash]);

    logger.info(`Aave supply transaction: ${tx.hash} for user ${userId}`);

    res.json({
      message: 'Asset supplied to Aave successfully',
      transactionHash: tx.hash,
      amount: amount,
      asset: asset
    });

  } catch (error) {
    logger.error('Aave supply error:', error);
    res.status(500).json({ error: 'Failed to supply asset to Aave' });
  }
});

// Withdraw assets from Aave
router.post('/aave/withdraw', [
  body('asset').notEmpty(),
  body('amount').isDecimal()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { asset, amount } = req.body;
    const userId = req.user.userId;

    // Get user wallet
    const userResult = await query('SELECT wallet_address, private_key_encrypted FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const wallet = getWallet(decryptPrivateKey(user.private_key_encrypted, req.body.password));

    // Get Aave contract
    const aaveContract = getContract('aave');
    if (!aaveContract) {
      return res.status(500).json({ error: 'Aave contract not available' });
    }

    // Execute withdraw transaction
    const tx = await aaveContract.withdraw(
      asset,
      ethers.parseUnits(amount.toString(), 18),
      user.wallet_address
    );

    // Update position in database
    await query(`
      UPDATE defi_positions 
      SET amount = amount - $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2 AND protocol = 'aave' AND asset = $3 AND status = 'active'
    `, [amount, userId, asset]);

    logger.info(`Aave withdraw transaction: ${tx.hash} for user ${userId}`);

    res.json({
      message: 'Asset withdrawn from Aave successfully',
      transactionHash: tx.hash,
      amount: amount,
      asset: asset
    });

  } catch (error) {
    logger.error('Aave withdraw error:', error);
    res.status(500).json({ error: 'Failed to withdraw asset from Aave' });
  }
});

// Swap tokens on Uniswap
router.post('/uniswap/swap', [
  body('tokenIn').notEmpty(),
  body('tokenOut').notEmpty(),
  body('amountIn').isDecimal(),
  body('amountOutMinimum').isDecimal(),
  body('fee').isInt({ min: 500, max: 10000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tokenIn, tokenOut, amountIn, amountOutMinimum, fee } = req.body;
    const userId = req.user.userId;

    // Get user wallet
    const userResult = await query('SELECT wallet_address, private_key_encrypted FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const wallet = getWallet(decryptPrivateKey(user.private_key_encrypted, req.body.password));

    // Get Uniswap contract
    const uniswapContract = getContract('uniswap');
    if (!uniswapContract) {
      return res.status(500).json({ error: 'Uniswap contract not available' });
    }

    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes

    // Execute swap transaction
    const tx = await uniswapContract.exactInputSingle({
      tokenIn,
      tokenOut,
      fee,
      recipient: user.wallet_address,
      deadline,
      amountIn: ethers.parseUnits(amountIn.toString(), 18),
      amountOutMinimum: ethers.parseUnits(amountOutMinimum.toString(), 18),
      sqrtPriceLimitX96: 0
    });

    logger.info(`Uniswap swap transaction: ${tx.hash} for user ${userId}`);

    res.json({
      message: 'Token swap completed successfully',
      transactionHash: tx.hash,
      tokenIn,
      tokenOut,
      amountIn
    });

  } catch (error) {
    logger.error('Uniswap swap error:', error);
    res.status(500).json({ error: 'Failed to execute swap' });
  }
});

// Join Balancer pool
router.post('/balancer/join', [
  body('poolId').notEmpty(),
  body('assets').isArray(),
  body('maxAmountsIn').isArray(),
  body('userData').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { poolId, assets, maxAmountsIn, userData = '0x' } = req.body;
    const userId = req.user.userId;

    // Get user wallet
    const userResult = await query('SELECT wallet_address, private_key_encrypted FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const wallet = getWallet(decryptPrivateKey(user.private_key_encrypted, req.body.password));

    // Get Balancer contract
    const balancerContract = getContract('balancer');
    if (!balancerContract) {
      return res.status(500).json({ error: 'Balancer contract not available' });
    }

    // Execute join pool transaction
    const tx = await balancerContract.joinPool(
      poolId,
      user.wallet_address,
      user.wallet_address,
      {
        assets,
        maxAmountsIn: maxAmountsIn.map(amount => ethers.parseUnits(amount.toString(), 18)),
        userData,
        fromInternalBalance: false
      }
    );

    logger.info(`Balancer join transaction: ${tx.hash} for user ${userId}`);

    res.json({
      message: 'Successfully joined Balancer pool',
      transactionHash: tx.hash,
      poolId
    });

  } catch (error) {
    logger.error('Balancer join error:', error);
    res.status(500).json({ error: 'Failed to join Balancer pool' });
  }
});

// Get DeFi analytics
router.get('/analytics', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's DeFi positions
    const positionsResult = await query(`
      SELECT protocol, position_type, asset, amount, apy, created_at
      FROM defi_positions
      WHERE user_id = $1 AND status = 'active'
    `, [userId]);

    // Calculate total value and APY
    let totalValue = 0;
    let weightedAPY = 0;
    let totalAmount = 0;

    positionsResult.rows.forEach(position => {
      const value = parseFloat(position.amount) * (position.apy || 0);
      totalValue += value;
      totalAmount += parseFloat(position.amount);
      weightedAPY += parseFloat(position.amount) * (position.apy || 0);
    });

    const averageAPY = totalAmount > 0 ? weightedAPY / totalAmount : 0;

    // Get protocol distribution
    const protocolStats = {};
    positionsResult.rows.forEach(position => {
      if (!protocolStats[position.protocol]) {
        protocolStats[position.protocol] = { count: 0, totalAmount: 0 };
      }
      protocolStats[position.protocol].count++;
      protocolStats[position.protocol].totalAmount += parseFloat(position.amount);
    });

    res.json({
      totalValue,
      averageAPY,
      totalPositions: positionsResult.rows.length,
      protocolDistribution: protocolStats,
      positions: positionsResult.rows
    });

  } catch (error) {
    logger.error('DeFi analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get DeFi recommendations from AI
router.post('/recommendations', [
  body('riskTolerance').isIn(['low', 'medium', 'high']),
  body('investmentAmount').isDecimal(),
  body('timeHorizon').isInt({ min: 1, max: 365 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { riskTolerance, investmentAmount, timeHorizon } = req.body;
    const userId = req.user.userId;

    // Get user's current positions
    const positionsResult = await query(`
      SELECT protocol, position_type, asset, amount, apy
      FROM defi_positions
      WHERE user_id = $1 AND status = 'active'
    `, [userId]);

    const prompt = `Based on the user's current DeFi portfolio and preferences, provide investment recommendations:

    Current Portfolio: ${JSON.stringify(positionsResult.rows, null, 2)}
    Risk Tolerance: ${riskTolerance}
    Investment Amount: ${investmentAmount}
    Time Horizon: ${timeHorizon} days

    Please provide:
    1. Recommended DeFi protocols (Aave, Uniswap, Balancer)
    2. Asset allocation suggestions
    3. Risk assessment
    4. Expected returns
    5. Liquidity considerations
    6. Market conditions analysis`;

    const aiResponse = await generateResponse(prompt);

    res.json({
      recommendations: aiResponse.content,
      riskTolerance,
      investmentAmount,
      timeHorizon
    });

  } catch (error) {
    logger.error('DeFi recommendations error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

module.exports = router;