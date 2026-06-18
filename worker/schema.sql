DROP TABLE IF EXISTS referral_earnings;
DROP TABLE IF EXISTS referrals;
DROP TABLE IF EXISTS round_results;
DROP TABLE IF EXISTS bets;
DROP TABLE IF EXISTS withdrawals;
DROP TABLE IF EXISTS deposits;
DROP TABLE IF EXISTS coin_ledger;
DROP TABLE IF EXISTS coin_balances;
DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  referral_code TEXT UNIQUE,
  referred_by_code TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coin_balances (
  wallet_address TEXT PRIMARY KEY,
  available_balance REAL NOT NULL DEFAULT 0,
  locked_balance REAL NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coin_ledger (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  round_id INTEGER,
  bet_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  test_usdt_amount REAL NOT NULL,
  gold_coin_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  gold_coin_amount REAL NOT NULL,
  test_usdt_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  round_id INTEGER NOT NULL,
  wallet_address TEXT NOT NULL,
  kind TEXT NOT NULL,
  color TEXT NOT NULL,
  number INTEGER,
  amount REAL NOT NULL,
  playable_amount REAL NOT NULL,
  house_fee REAL NOT NULL,
  maintenance_fee REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  result TEXT,
  payout_amount REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  settled_at TEXT
);

CREATE TABLE IF NOT EXISTS round_results (
  id TEXT PRIMARY KEY,
  round_id INTEGER UNIQUE NOT NULL,
  winning_color TEXT,
  winning_number INTEGER,
  final_hash TEXT,
  reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coin_ledger_wallet ON coin_ledger(wallet_address);
CREATE INDEX IF NOT EXISTS idx_bets_round ON bets(round_id);
CREATE INDEX IF NOT EXISTS idx_bets_wallet ON bets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_results_round ON round_results(round_id);
CREATE TABLE IF NOT EXISTS referral_earnings (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  from_wallet_address TEXT NOT NULL,
  level INTEGER NOT NULL,
  bet_id TEXT NOT NULL,
  round_id INTEGER NOT NULL,
  commission_amount REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_referral_earnings_wallet ON referral_earnings(wallet_address);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_bet ON referral_earnings(bet_id);

CREATE TABLE IF NOT EXISTS auth_nonces (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  message TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_nonces_wallet ON auth_nonces(wallet_address);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_wallet ON auth_sessions(wallet_address);