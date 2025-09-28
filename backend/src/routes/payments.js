const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const Stripe = require('stripe');
const axios = require('axios');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize payment providers
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe payment
router.post('/stripe/create-payment-intent', [
  body('amount').isDecimal(),
  body('currency').isLength({ min: 3, max: 3 }),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, currency, description = 'Web3 Bank Monera payment' } = req.body;
    const userId = req.user.userId;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(amount) * 100), // Convert to cents
      currency: currency.toLowerCase(),
      description,
      metadata: {
        userId: userId.toString(),
        bankTransaction: 'true'
      }
    });

    // Log payment intent
    await query(`
      INSERT INTO transactions (from_account_id, amount, currency, transaction_type, status, description, reference)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [null, amount, currency, 'stripe_payment', 'pending', description, paymentIntent.id]);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    logger.error('Stripe payment intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Confirm Stripe payment
router.post('/stripe/confirm-payment', [
  body('paymentIntentId').notEmpty(),
  body('amount').isDecimal()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paymentIntentId, amount } = req.body;
    const userId = req.user.userId;

    // Retrieve payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Get user's bank account
    const accountResult = await query(`
      SELECT id FROM bank_accounts WHERE user_id = $1 LIMIT 1
    `, [userId]);

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    // Update account balance
    await query(`
      UPDATE bank_accounts 
      SET balance = balance + $1, available_balance = available_balance + $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
    `, [amount, userId]);

    // Update transaction status
    await query(`
      UPDATE transactions 
      SET status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE reference = $1
    `, [paymentIntentId]);

    // Earn bank tokens from fee
    const feePercentage = parseFloat(process.env.BANK_TOKEN_EMISSION_RATE || '0.05');
    const tokenEarned = amount * (feePercentage / 100);

    if (tokenEarned > 0) {
      await query(`
        UPDATE bank_tokens 
        SET balance = balance + $1, earned_tokens = earned_tokens + $1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `, [tokenEarned, userId]);
    }

    logger.info(`Stripe payment confirmed: ${amount} for user ${userId}`);

    res.json({
      message: 'Payment confirmed successfully',
      amount: amount,
      tokensEarned: tokenEarned
    });

  } catch (error) {
    logger.error('Stripe payment confirmation error:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// ЮMoney payment
router.post('/yumoney/create-payment', [
  body('amount').isDecimal(),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, description = 'Web3 Bank Monera payment' } = req.body;
    const userId = req.user.userId;

    // Create ЮMoney payment request
    const paymentData = {
      client_id: process.env.YUMONEY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${process.env.FRONTEND_URL}/payment/yumoney/callback`,
      scope: 'account-info operation-history operation-details',
      state: `user_${userId}_${Date.now()}`
    };

    const authUrl = `https://yoomoney.ru/oauth/authorize?${new URLSearchParams(paymentData).toString()}`;

    // Log payment request
    await query(`
      INSERT INTO transactions (from_account_id, amount, currency, transaction_type, status, description, reference)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [null, amount, 'RUB', 'yumoney_payment', 'pending', description, paymentData.state]);

    res.json({
      authUrl,
      state: paymentData.state
    });

  } catch (error) {
    logger.error('ЮMoney payment error:', error);
    res.status(500).json({ error: 'Failed to create ЮMoney payment' });
  }
});

// Payeer payment
router.post('/payeer/create-payment', [
  body('amount').isDecimal(),
  body('currency').isIn(['USD', 'EUR', 'RUB']),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, currency, description = 'Web3 Bank Monera payment' } = req.body;
    const userId = req.user.userId;

    // Create Payeer payment
    const paymentData = {
      m_shop: process.env.PAYEER_MERCHANT_ID,
      m_orderid: `MNR_${userId}_${Date.now()}`,
      m_amount: amount,
      m_curr: currency,
      m_desc: Buffer.from(description).toString('base64'),
      m_sign: require('crypto')
        .createHash('sha256')
        .update(`${process.env.PAYEER_MERCHANT_ID}:${amount}:${currency}:${process.env.PAYEER_API_KEY}`)
        .digest('hex')
        .toUpperCase()
    };

    // Log payment request
    await query(`
      INSERT INTO transactions (from_account_id, amount, currency, transaction_type, status, description, reference)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [null, amount, currency, 'payeer_payment', 'pending', description, paymentData.m_orderid]);

    res.json({
      paymentUrl: 'https://payeer.com/merchant/',
      paymentData
    });

  } catch (error) {
    logger.error('Payeer payment error:', error);
    res.status(500).json({ error: 'Failed to create Payeer payment' });
  }
});

// iCard payment
router.post('/icard/create-payment', [
  body('amount').isDecimal(),
  body('currency').isIn(['BGN', 'EUR', 'USD']),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, currency, description = 'Web3 Bank Monera payment' } = req.body;
    const userId = req.user.userId;

    // Create iCard payment
    const paymentData = {
      merchant_id: process.env.ICARD_MERCHANT_ID,
      order_id: `MNR_${userId}_${Date.now()}`,
      amount: amount,
      currency: currency,
      description: description,
      return_url: `${process.env.FRONTEND_URL}/payment/icard/success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/icard/cancel`,
      signature: require('crypto')
        .createHmac('sha256', process.env.ICARD_API_KEY)
        .update(`${process.env.ICARD_MERCHANT_ID}${amount}${currency}`)
        .digest('hex')
    };

    // Log payment request
    await query(`
      INSERT INTO transactions (from_account_id, amount, currency, transaction_type, status, description, reference)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [null, amount, currency, 'icard_payment', 'pending', description, paymentData.order_id]);

    res.json({
      paymentUrl: 'https://icard.com/payment/',
      paymentData
    });

  } catch (error) {
    logger.error('iCard payment error:', error);
    res.status(500).json({ error: 'Failed to create iCard payment' });
  }
});

// Get payment methods
router.get('/methods', async (req, res) => {
  try {
    const methods = [
      {
        id: 'stripe',
        name: 'Stripe',
        currencies: ['USD', 'EUR', 'BGN'],
        fees: '2.9% + 30¢',
        icon: 'stripe-icon'
      },
      {
        id: 'yumoney',
        name: 'ЮMoney',
        currencies: ['RUB'],
        fees: '0.5%',
        icon: 'yumoney-icon'
      },
      {
        id: 'payeer',
        name: 'Payeer',
        currencies: ['USD', 'EUR', 'RUB'],
        fees: '0.95%',
        icon: 'payeer-icon'
      },
      {
        id: 'icard',
        name: 'iCard',
        currencies: ['BGN', 'EUR', 'USD'],
        fees: '1.5%',
        icon: 'icard-icon'
      }
    ];

    res.json({ methods });

  } catch (error) {
    logger.error('Get payment methods error:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// Get payment history
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
        t.reference,
        t.created_at
      FROM transactions t
      WHERE t.transaction_type IN ('stripe_payment', 'yumoney_payment', 'payeer_payment', 'icard_payment')
      AND t.from_account_id IS NULL
      ORDER BY t.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      payments: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    logger.error('Get payment history error:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// Webhook handlers
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      
      // Update transaction status
      await query(`
        UPDATE transactions 
        SET status = 'completed', updated_at = CURRENT_TIMESTAMP
        WHERE reference = $1
      `, [paymentIntent.id]);

      logger.info(`Stripe webhook: Payment succeeded ${paymentIntent.id}`);
    }

    res.json({ received: true });

  } catch (error) {
    logger.error('Stripe webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

module.exports = router;