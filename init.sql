-- Web3 Bank Monera Database Initialization
-- This script initializes the database with required extensions and initial data

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kyc_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_type AS ENUM ('checking', 'savings', 'business', 'premium');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_defi_positions_user_id ON defi_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_tokens_user_id ON bank_tokens(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_defi_positions_updated_at BEFORE UPDATE ON defi_positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_tokens_updated_at BEFORE UPDATE ON bank_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchange_orders_updated_at BEFORE UPDATE ON exchange_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON ai_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_settings_updated_at BEFORE UPDATE ON admin_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial admin settings
INSERT INTO admin_settings (key, value, description) VALUES
('bank_token_burn_rate', '0.1', 'Percentage of tokens burned per transaction'),
('bank_token_emission_rate', '0.05', 'Percentage of fees converted to tokens'),
('min_transaction_amount', '1.00', 'Minimum transaction amount in BGN'),
('max_daily_transaction', '10000.00', 'Maximum daily transaction limit'),
('kyc_required_amount', '1000.00', 'Amount above which KYC is required'),
('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
('api_rate_limit', '100', 'API rate limit per minute'),
('session_timeout', '3600', 'Session timeout in seconds'),
('two_factor_required', 'false', 'Require 2FA for all users'),
('auto_kyc_approval', 'false', 'Automatically approve KYC submissions')
ON CONFLICT (key) DO NOTHING;

-- Create view for user statistics
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.kyc_status,
    u.created_at,
    ba.balance as bank_balance,
    bt.balance as token_balance,
    bt.earned_tokens,
    bt.burned_tokens,
    COUNT(t.id) as transaction_count,
    SUM(CASE WHEN t.status = 'completed' THEN t.amount ELSE 0 END) as total_transaction_amount
FROM users u
LEFT JOIN bank_accounts ba ON u.id = ba.user_id
LEFT JOIN bank_tokens bt ON u.id = bt.user_id
LEFT JOIN transactions t ON (t.from_account_id = ba.id OR t.to_account_id = ba.id)
GROUP BY u.id, u.email, u.first_name, u.last_name, u.kyc_status, u.created_at, ba.balance, bt.balance, bt.earned_tokens, bt.burned_tokens;

-- Create view for transaction analytics
CREATE OR REPLACE VIEW transaction_analytics AS
SELECT 
    DATE(created_at) as date,
    transaction_type,
    status,
    currency,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    AVG(amount) as average_amount,
    SUM(fee) as total_fees
FROM transactions
GROUP BY DATE(created_at), transaction_type, status, currency;

-- Create view for DeFi analytics
CREATE OR REPLACE VIEW defi_analytics AS
SELECT 
    protocol,
    position_type,
    asset,
    COUNT(*) as position_count,
    SUM(amount) as total_amount,
    AVG(apy) as average_apy,
    SUM(amount * apy / 100) as estimated_yearly_return
FROM defi_positions
WHERE status = 'active'
GROUP BY protocol, position_type, asset;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO web3bank;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO web3bank;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO web3bank;

-- Create backup user for read-only access
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'web3bank_readonly') THEN
        CREATE ROLE web3bank_readonly;
    END IF;
END
$$;

GRANT CONNECT ON DATABASE web3bank TO web3bank_readonly;
GRANT USAGE ON SCHEMA public TO web3bank_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO web3bank_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO web3bank_readonly;

-- Set up connection limits
ALTER USER web3bank CONNECTION LIMIT 50;
ALTER USER web3bank_readonly CONNECTION LIMIT 10;

-- Create function for database health check
CREATE OR REPLACE FUNCTION health_check()
RETURNS TABLE(
    database_name text,
    current_connections integer,
    max_connections integer,
    database_size text,
    uptime interval
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        current_database()::text,
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::integer,
        (SELECT setting::integer FROM pg_settings WHERE name = 'max_connections'),
        pg_size_pretty(pg_database_size(current_database()))::text,
        (SELECT now() - pg_postmaster_start_time())::interval;
END;
$$ LANGUAGE plpgsql;

-- Create function for transaction summary
CREATE OR REPLACE FUNCTION get_transaction_summary(
    user_id_param integer,
    start_date_param date DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date_param date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    transaction_type text,
    total_count bigint,
    total_amount numeric,
    average_amount numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.transaction_type,
        COUNT(*) as total_count,
        SUM(t.amount) as total_amount,
        AVG(t.amount) as average_amount
    FROM transactions t
    JOIN bank_accounts ba ON (t.from_account_id = ba.id OR t.to_account_id = ba.id)
    WHERE ba.user_id = user_id_param
    AND t.created_at >= start_date_param
    AND t.created_at <= end_date_param
    GROUP BY t.transaction_type;
END;
$$ LANGUAGE plpgsql;

COMMIT;