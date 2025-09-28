const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

const setupDatabase = async () => {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    logger.info('✅ Database connected successfully');
    
    // Initialize tables
    await initializeTables();
    
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

const initializeTables = async () => {
  const client = await pool.connect();
  
  try {
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        date_of_birth DATE,
        address TEXT,
        city VARCHAR(100),
        country VARCHAR(100),
        postal_code VARCHAR(20),
        kyc_status VARCHAR(20) DEFAULT 'pending',
        kyc_documents JSONB,
        wallet_address VARCHAR(42),
        private_key_encrypted TEXT,
        two_factor_enabled BOOLEAN DEFAULT false,
        two_factor_secret VARCHAR(32),
        language VARCHAR(5) DEFAULT 'bg',
        timezone VARCHAR(50) DEFAULT 'Europe/Sofia',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Bank accounts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        account_number VARCHAR(50) UNIQUE NOT NULL,
        iban VARCHAR(34),
        account_type VARCHAR(20) DEFAULT 'checking',
        currency VARCHAR(3) DEFAULT 'BGN',
        balance DECIMAL(20,2) DEFAULT 0.00,
        available_balance DECIMAL(20,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid(),
        from_account_id INTEGER REFERENCES bank_accounts(id),
        to_account_id INTEGER REFERENCES bank_accounts(id),
        amount DECIMAL(20,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        transaction_type VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        description TEXT,
        reference VARCHAR(100),
        fee DECIMAL(20,2) DEFAULT 0.00,
        blockchain_tx_hash VARCHAR(66),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // DeFi positions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS defi_positions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        protocol VARCHAR(50) NOT NULL,
        position_type VARCHAR(20) NOT NULL,
        asset VARCHAR(20) NOT NULL,
        amount DECIMAL(20,8) NOT NULL,
        apy DECIMAL(8,4),
        status VARCHAR(20) DEFAULT 'active',
        tx_hash VARCHAR(66),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Bank tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        balance DECIMAL(20,8) DEFAULT 0.00,
        burned_tokens DECIMAL(20,8) DEFAULT 0.00,
        earned_tokens DECIMAL(20,8) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Exchange orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS exchange_orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        exchange VARCHAR(20) NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        side VARCHAR(10) NOT NULL,
        amount DECIMAL(20,8) NOT NULL,
        price DECIMAL(20,8),
        order_type VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        exchange_order_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // AI conversations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_id VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        response TEXT,
        ai_model VARCHAR(50),
        tokens_used INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Admin settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default admin settings
    await client.query(`
      INSERT INTO admin_settings (key, value, description) VALUES
      ('bank_token_burn_rate', '0.1', 'Percentage of tokens burned per transaction'),
      ('bank_token_emission_rate', '0.05', 'Percentage of fees converted to tokens'),
      ('min_transaction_amount', '1.00', 'Minimum transaction amount in BGN'),
      ('max_daily_transaction', '10000.00', 'Maximum daily transaction limit'),
      ('kyc_required_amount', '1000.00', 'Amount above which KYC is required')
      ON CONFLICT (key) DO NOTHING
    `);

    logger.info('✅ Database tables initialized successfully');
    
  } catch (error) {
    logger.error('❌ Failed to initialize database tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

const getPool = () => pool;

const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Database query error:', error);
    throw error;
  }
};

module.exports = {
  setupDatabase,
  getPool,
  query
};