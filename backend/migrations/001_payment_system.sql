-- TiTicket Payment System Migration
-- Created: 15 Apr 2026
-- Payment tables for VNPay integration

-- Table: orders (đơn hàng)
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  order_code VARCHAR(50) UNIQUE NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  commission DECIMAL(12, 2) DEFAULT 0,
  net_amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
  payment_method VARCHAR(20) DEFAULT 'vnpay', -- vnpay, bank_transfer
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP -- For hold timeout (15 minutes after creation)
);

-- Table: payments (giao dịch)
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  transaction_id VARCHAR(100) UNIQUE,
  request_id VARCHAR(100),
  vnpay_trans_id VARCHAR(100) UNIQUE, -- Transaction ID from VNPay
  amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  response_code VARCHAR(10),
  message TEXT,
  raw_response JSONB, -- Store full VNPay response
  verified_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: transaction_logs (lịch sử giao dịch)
CREATE TABLE IF NOT EXISTS transaction_logs (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  action VARCHAR(50), -- initiate, webhook_received, verified, confirmed, failed, refund_initiated, refund_completed
  status VARCHAR(20),
  amount DECIMAL(12, 2),
  previous_status VARCHAR(20),
  new_status VARCHAR(20),
  metadata JSONB, -- Store additional context
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: order_items (chi tiết ghế trong đơn hàng)
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seat_id INTEGER REFERENCES seats(id) ON DELETE SET NULL,
  zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 1, -- For zone tickets
  unit_price DECIMAL(12, 2) NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, cancelled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: refunds (hoàn tiền)
CREATE TABLE IF NOT EXISTS refunds (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  reason VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  vnpay_refund_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_vnpay_trans_id ON payments(vnpay_trans_id);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_order_id ON transaction_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_payment_id ON transaction_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_created_at ON transaction_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seat_id ON order_items(seat_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- Add status column to seat_holds if not exists (for tracking)
ALTER TABLE seat_holds ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE seat_holds ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'held'; -- held, confirmed, released, expired

-- Update existing tickets with payment tracking
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;
