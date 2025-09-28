const Stripe = require('stripe');
const axios = require('axios');
const logger = require('../utils/logger');

let stripe;
let paymentProviders = {};

const setupPayments = async () => {
  try {
    // Initialize Stripe
    if (process.env.STRIPE_SECRET_KEY) {
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      paymentProviders.stripe = stripe;
      logger.info('✅ Stripe initialized');
    }

    // Initialize ЮMoney
    if (process.env.YUMONEY_CLIENT_ID) {
      paymentProviders.yumoney = {
        clientId: process.env.YUMONEY_CLIENT_ID,
        clientSecret: process.env.YUMONEY_CLIENT_SECRET,
        baseUrl: 'https://yoomoney.ru'
      };
      logger.info('✅ ЮMoney initialized');
    }

    // Initialize Payeer
    if (process.env.PAYEER_MERCHANT_ID) {
      paymentProviders.payeer = {
        merchantId: process.env.PAYEER_MERCHANT_ID,
        apiKey: process.env.PAYEER_API_KEY,
        baseUrl: 'https://payeer.com'
      };
      logger.info('✅ Payeer initialized');
    }

    // Initialize iCard
    if (process.env.ICARD_MERCHANT_ID) {
      paymentProviders.icard = {
        merchantId: process.env.ICARD_MERCHANT_ID,
        apiKey: process.env.ICARD_API_KEY,
        baseUrl: 'https://icard.com'
      };
      logger.info('✅ iCard initialized');
    }

    logger.info('✅ Payment providers initialized successfully');
    
  } catch (error) {
    logger.error('❌ Payment setup failed:', error);
    throw error;
  }
};

const getStripe = () => stripe;

const getPaymentProvider = (provider) => {
  return paymentProviders[provider];
};

// Payment processing utilities
const processPayment = async (provider, paymentData) => {
  try {
    switch (provider) {
      case 'stripe':
        return await processStripePayment(paymentData);
      case 'yumoney':
        return await processYumoneyPayment(paymentData);
      case 'payeer':
        return await processPayeerPayment(paymentData);
      case 'icard':
        return await processIcardPayment(paymentData);
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  } catch (error) {
    logger.error(`Payment processing error for ${provider}:`, error);
    throw error;
  }
};

const processStripePayment = async (paymentData) => {
  const { amount, currency, customerId, paymentMethodId } = paymentData;
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: currency.toLowerCase(),
    customer: customerId,
    payment_method: paymentMethodId,
    confirmation_method: 'manual',
    confirm: true
  });

  return {
    id: paymentIntent.id,
    status: paymentIntent.status,
    clientSecret: paymentIntent.client_secret
  };
};

const processYumoneyPayment = async (paymentData) => {
  const { amount, description, returnUrl } = paymentData;
  
  // ЮMoney payment processing logic
  const paymentUrl = `${paymentProviders.yumoney.baseUrl}/quickpay/confirm.xml`;
  
  const params = {
    receiver: process.env.YUMONEY_WALLET_ID,
    'quickpay-form': 'shop',
    targets: description,
    paymentType: 'SB',
    sum: amount,
    label: `payment_${Date.now()}`
  };

  return {
    paymentUrl,
    params
  };
};

const processPayeerPayment = async (paymentData) => {
  const { amount, currency, description } = paymentData;
  
  const crypto = require('crypto');
  const orderId = `MNR_${Date.now()}`;
  
  const params = {
    m_shop: paymentProviders.payeer.merchantId,
    m_orderid: orderId,
    m_amount: amount,
    m_curr: currency,
    m_desc: Buffer.from(description).toString('base64'),
    m_sign: crypto
      .createHash('sha256')
      .update(`${paymentProviders.payeer.merchantId}:${amount}:${currency}:${paymentProviders.payeer.apiKey}`)
      .digest('hex')
      .toUpperCase()
  };

  return {
    paymentUrl: `${paymentProviders.payeer.baseUrl}/merchant/`,
    params
  };
};

const processIcardPayment = async (paymentData) => {
  const { amount, currency, description, returnUrl } = paymentData;
  
  const crypto = require('crypto');
  const orderId = `MNR_${Date.now()}`;
  
  const signature = crypto
    .createHmac('sha256', paymentProviders.icard.apiKey)
    .update(`${paymentProviders.icard.merchantId}${amount}${currency}`)
    .digest('hex');

  const params = {
    merchant_id: paymentProviders.icard.merchantId,
    order_id: orderId,
    amount: amount,
    currency: currency,
    description: description,
    return_url: returnUrl,
    signature: signature
  };

  return {
    paymentUrl: `${paymentProviders.icard.baseUrl}/payment/`,
    params
  };
};

// Webhook verification
const verifyWebhook = (provider, payload, signature) => {
  try {
    switch (provider) {
      case 'stripe':
        return stripe.webhooks.constructEvent(
          payload,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      case 'yumoney':
        // Implement ЮMoney webhook verification
        return JSON.parse(payload);
      case 'payeer':
        // Implement Payeer webhook verification
        return JSON.parse(payload);
      case 'icard':
        // Implement iCard webhook verification
        return JSON.parse(payload);
      default:
        throw new Error(`Unsupported webhook provider: ${provider}`);
    }
  } catch (error) {
    logger.error(`Webhook verification error for ${provider}:`, error);
    throw error;
  }
};

// Refund processing
const processRefund = async (provider, refundData) => {
  try {
    switch (provider) {
      case 'stripe':
        return await stripe.refunds.create({
          payment_intent: refundData.paymentIntentId,
          amount: Math.round(refundData.amount * 100)
        });
      default:
        throw new Error(`Refund not supported for provider: ${provider}`);
    }
  } catch (error) {
    logger.error(`Refund processing error for ${provider}:`, error);
    throw error;
  }
};

module.exports = {
  setupPayments,
  getStripe,
  getPaymentProvider,
  processPayment,
  verifyWebhook,
  processRefund
};