export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(100),
  unit VARCHAR(50) DEFAULT 'pcs',
  low_stock_threshold INTEGER DEFAULT 10,
  master_stock INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platforms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(20) DEFAULT '#6366f1',
  type VARCHAR(20) DEFAULT 'online',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
  type VARCHAR(30) NOT NULL,
  quantity INTEGER NOT NULL,
  direction SMALLINT NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  supplier VARCHAR(255),
  cost_per_unit DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'manager',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_txn_product  ON stock_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_txn_platform ON stock_transactions(platform_id);
CREATE INDEX IF NOT EXISTS idx_txn_date     ON stock_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_txn_type     ON stock_transactions(type);

INSERT INTO platforms (name, color, type) VALUES
  ('Blinkit',   '#F8C42A', 'online'),
  ('Zepto',     '#8A2BE2', 'online'),
  ('Instamart', '#FF6B35', 'online'),
  ('Flipkart',  '#2874F0', 'online'),
  ('Amazon',    '#FF9900', 'online'),
  ('BigBasket', '#84C225', 'online'),
  ('Offline',   '#64748b', 'offline'),
  ('Gift',      '#ec4899', 'other')
ON CONFLICT (name) DO NOTHING;
`;
