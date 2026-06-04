-- StockFlow v2 Schema: Master Stock Model

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
  type VARCHAR(20) DEFAULT 'online',  -- 'online', 'offline', 'other'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- All stock movements in one table
-- type: 'restock' | 'sale' | 'return' | 'gift' | 'offline_sale' | 'adjustment'
CREATE TABLE IF NOT EXISTS stock_transactions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
  type VARCHAR(30) NOT NULL,       -- restock, sale, return, gift, offline_sale, adjustment
  quantity INTEGER NOT NULL,        -- always positive
  direction SMALLINT NOT NULL,      -- +1 = adds to master, -1 = deducts from master
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  supplier VARCHAR(255),           -- for restock only
  cost_per_unit DECIMAL(10,2),     -- for restock only
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_txn_product ON stock_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_txn_platform ON stock_transactions(platform_id);
CREATE INDEX IF NOT EXISTS idx_txn_date ON stock_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_txn_type ON stock_transactions(type);

-- Default platforms
INSERT INTO platforms (name, color, type) VALUES
  ('Blinkit',    '#F8C42A', 'online'),
  ('Zepto',      '#8A2BE2', 'online'),
  ('Instamart',  '#FF6B35', 'online'),
  ('Flipkart',   '#2874F0', 'online'),
  ('Amazon',     '#FF9900', 'online'),
  ('BigBasket',  '#84C225', 'online'),
  ('Offline',    '#64748b', 'offline'),
  ('Gift',       '#ec4899', 'other')
ON CONFLICT (name) DO NOTHING;
