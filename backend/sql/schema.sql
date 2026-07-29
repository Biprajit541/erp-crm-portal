-- =====================================================
-- Mini ERP + CRM Portal - PostgreSQL Schema
-- Run this in Supabase SQL Editor (or via npm run db:schema)
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN','SALES','WAREHOUSE','ACCOUNTS')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id             SERIAL PRIMARY KEY,
  customer_name  VARCHAR(150) NOT NULL,
  mobile         VARCHAR(15)  NOT NULL,
  email          VARCHAR(150),
  business_name  VARCHAR(150),
  gst_number     VARCHAR(20),
  customer_type  VARCHAR(20) NOT NULL CHECK (customer_type IN ('RETAIL','WHOLESALE','DISTRIBUTOR')),
  address        TEXT,
  status         VARCHAR(20) NOT NULL DEFAULT 'LEAD' CHECK (status IN ('LEAD','ACTIVE','INACTIVE')),
  follow_up_date DATE,
  notes          TEXT,
  created_by     INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_followups (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id              SERIAL PRIMARY KEY,
  product_name    VARCHAR(150) NOT NULL,
  sku             VARCHAR(50) UNIQUE NOT NULL,
  category        VARCHAR(100),
  unit_price      NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  current_stock   INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  min_stock_alert INTEGER NOT NULL DEFAULT 0,
  location        VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id            SERIAL PRIMARY KEY,
  product_id    INTEGER NOT NULL REFERENCES products(id),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  movement_type VARCHAR(5) NOT NULL CHECK (movement_type IN ('IN','OUT')),
  reason        VARCHAR(200) NOT NULL,
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challans (
  id             SERIAL PRIMARY KEY,
  challan_number VARCHAR(30) UNIQUE NOT NULL,
  customer_id    INTEGER NOT NULL REFERENCES customers(id),
  total_quantity INTEGER NOT NULL DEFAULT 0,
  status         VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','CONFIRMED','CANCELLED')),
  created_by     INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Challan items store a PRODUCT SNAPSHOT (name, sku, price at the time),
-- not only the product id - as required by the case study.
CREATE TABLE IF NOT EXISTS challan_items (
  id           SERIAL PRIMARY KEY,
  challan_id   INTEGER NOT NULL REFERENCES challans(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  product_name VARCHAR(150) NOT NULL,
  sku          VARCHAR(50) NOT NULL,
  unit_price   NUMERIC(12,2) NOT NULL,
  quantity     INTEGER NOT NULL CHECK (quantity > 0)
);

-- Sequence used for generating challan numbers
CREATE SEQUENCE IF NOT EXISTS challan_number_seq START 1;

CREATE INDEX IF NOT EXISTS idx_customers_name   ON customers (LOWER(customer_name));
CREATE INDEX IF NOT EXISTS idx_products_sku     ON products (LOWER(sku));
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_challans_customer ON challans (customer_id);