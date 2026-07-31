-- ChainFinex – Required Supabase Schema Additions
-- Run these SQL commands in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query)

-- 1. NOTIFICATIONS TABLE
-- Required for the notifications system to work
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(user_id, read);

-- 2. ADD DECLINE_REASON TO WITHDRAWALS TABLE
-- Required for admin to provide decline reasons
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS decline_reason TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- 3. ADD REJECT_REASON TO PENDING_PAYMENTS TABLE
ALTER TABLE pending_payments ADD COLUMN IF NOT EXISTS reject_reason TEXT;
ALTER TABLE pending_payments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE pending_payments ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- 4. ADD SOURCE COLUMN TO WITHDRAWALS TABLE (if not present)
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'balance';

-- 5. ENSURE ACTIVITY_LOGS HAS METADATA AS JSONB
-- (If your metadata column is TEXT, this converts it; if already JSONB, this is a no-op)
-- NOTE: Only run this if metadata is currently TEXT:
-- ALTER TABLE activity_logs ALTER COLUMN metadata TYPE JSONB USING metadata::jsonb;

-- 6. ROW LEVEL SECURITY (Optional but recommended)
-- Enable RLS and add policies so users can only see their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Service role has full access to notifications" ON notifications
  FOR ALL USING (true);

-- 7. EXISTING TABLES VERIFICATION
-- Make sure these tables exist with the right columns.
-- If they don't exist, create them:

-- users table should have:
--   id, name, email, password_hash, role, balance, created_at,
--   avatar_url, phone, date_of_birth, country, address,
--   withdraw_password_hash, withdraw_password_set,
--   referral_code, referred_by, referral_bonus, referral_bonus_paid,
--   pending_withdrawal

-- withdrawals table should have:
--   id, user_id, currency, amount, wallet_address, source, status,
--   decline_reason, processed_at, created_at

-- pending_payments table should have:
--   id, user_id, amount, method, status, submitted_at, created_at,
--   approved_at, rejected_at, reject_reason

-- transactions table should have:
--   id, user_id, type, amount, status, description, created_at

-- activity_logs table should have:
--   id, user_id, type, metadata (jsonb or text), created_at

-- 8. WELCOME BONUS & CUSTOM PROFIT PERCENTAGE (new features)
-- No schema changes required. The existing 'referral_bonus' column on users
-- is used to hold the $500 welcome bonus. Users transfer it to main balance
-- via the existing /api/referral/transfer endpoint.
-- A 'welcome_bonus' transaction type is inserted into the transactions table
-- on registration -- no column changes needed there.
--
-- Admin profit %: the investments pay endpoint now accepts an optional
-- 'percentage' body param (2–40) that overrides the plan's daily_profit rate.
-- No schema changes are required for this feature.

-- ════════════════════════════════════════════════════════════════════════════
-- MANAGED ACCOUNTS (New Feature)
-- ════════════════════════════════════════════════════════════════════════════

-- 9. MANAGED ACCOUNT PLANS TABLE
CREATE TABLE IF NOT EXISTS managed_account_plans (
  id         SERIAL PRIMARY KEY,
  name       TEXT    NOT NULL,
  price      NUMERIC NOT NULL,
  icon       TEXT    DEFAULT '📊',
  description TEXT,
  features   JSONB   DEFAULT '[]',
  popular    BOOLEAN DEFAULT false,
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default plans (run once; if already present these are no-ops via ON CONFLICT)
INSERT INTO managed_account_plans (name, price, icon, description, features, popular, active) VALUES
  ('Basic', 49, '🌱', 'Perfect for beginners looking to grow their investment with professional management.',
   '["Professional account management","Daily performance updates","Basic risk management","Email support"]',
   false, true),
  ('Standard', 149, '⚡', 'Our most popular plan with enhanced features for steady growth.',
   '["Advanced account management","Real-time portfolio monitoring","Advanced risk management","Priority email & chat support","Weekly performance report"]',
   true, true),
  ('Premium', 349, '💎', 'Maximum exposure with a dedicated account manager for serious investors.',
   '["Dedicated account manager","High-frequency trading strategies","Institutional-grade risk tools","24/7 priority support","Daily performance reports","Custom strategy consultation"]',
   false, true),
  ('Enterprise', 999, '🏛️', 'Full-service VIP management for high-net-worth individuals.',
   '["VIP dedicated team","Custom trading strategies","Full portfolio diversification","Direct phone & video support","Real-time 24/7 monitoring","Monthly in-depth analysis","Exclusive market intelligence"]',
   false, true)
ON CONFLICT DO NOTHING;

-- 10. MANAGED ACCOUNT SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS managed_account_subscriptions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id      INTEGER REFERENCES managed_account_plans(id),
  plan_name    TEXT    NOT NULL,
  plan_price   NUMERIC NOT NULL DEFAULT 0,
  status       TEXT    NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','pending','cancelled')),
  admin_notes  TEXT,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_managed_subs_user_id ON managed_account_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_managed_subs_status  ON managed_account_subscriptions(status);
