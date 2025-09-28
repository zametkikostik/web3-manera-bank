const bcrypt = require('bcryptjs');
const { query } = require('../src/config/database');
const { createWallet, encryptPrivateKey } = require('../src/config/web3');
const logger = require('../src/utils/logger');

async function createAdmin() {
  try {
    console.log('Creating admin user...');

    // Check if admin already exists
    const existingAdmin = await query('SELECT id FROM users WHERE email = $1', ['admin@web3bankmonera.com']);
    if (existingAdmin.rows.length > 0) {
      console.log('Admin user already exists');
      return;
    }

    // Create admin wallet
    const wallet = createWallet();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey, adminPassword);

    // Create admin user
    const result = await query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, wallet_address, private_key_encrypted, kyc_status, language)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, uuid, email, first_name, last_name, wallet_address
    `, [
      'admin@web3bankmonera.com',
      passwordHash,
      'Admin',
      'User',
      '+359888888888',
      wallet.address,
      encryptedPrivateKey,
      'approved',
      'bg'
    ]);

    const admin = result.rows[0];

    // Create admin bank account
    const accountNumber = `ADMIN${Date.now()}`;
    await query(`
      INSERT INTO bank_accounts (user_id, account_number, iban, currency, balance, available_balance)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [admin.id, accountNumber, `BG80BNBG96611020345678${accountNumber}`, 'BGN', 1000000, 1000000]);

    // Create admin token account
    await query(`
      INSERT INTO bank_tokens (user_id, balance, earned_tokens)
      VALUES ($1, $2, $3)
    `, [admin.id, 1000000, 1000000]);

    console.log('✅ Admin user created successfully');
    console.log(`   Email: admin@web3bankmonera.com`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Wallet Address: ${wallet.address}`);
    console.log(`   Account Number: ${accountNumber}`);

  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    process.exit(1);
  }
}

createAdmin();