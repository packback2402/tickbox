-- =============================================
-- TiTicket — Database Init Script
-- Chạy tự động khi Docker PostgreSQL container khởi động lần đầu
-- Tổng hợp toàn bộ schema + seed data cơ bản
-- =============================================

-- Extension cần thiết cho tìm kiếm tiếng Việt (unaccent)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- =============================================
-- 1. BẢNG CƠ SỞ (Base tables)
-- =============================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'organizer', 'admin')),
  full_name VARCHAR(255),
  phone VARCHAR(20),
  avatar_url TEXT,
  date_of_birth DATE,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS organizer_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_name VARCHAR(255),
  phone VARCHAR(20),
  description TEXT,
  logo_url TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  event_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  location VARCHAR(255) NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  organizer VARCHAR(255),
  organizer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_featured BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected', 'cancelled')),
  has_seatmap BOOLEAN DEFAULT FALSE,
  seatmap_type VARCHAR(20) DEFAULT 'none',
  -- Step 4: Payment info
  bank_account_holder VARCHAR(255),
  bank_account_number VARCHAR(50),
  bank_name VARCHAR(100),
  bank_branch VARCHAR(255),
  want_invoice BOOLEAN DEFAULT FALSE,
  invoice_business_type VARCHAR(20) DEFAULT 'personal',
  invoice_full_name VARCHAR(255),
  invoice_company_name VARCHAR(255),
  invoice_tax_code VARCHAR(20),
  invoice_address TEXT,
  license_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  quantity_available INTEGER DEFAULT 0,
  payment_id INTEGER,
  order_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 2. SƠ ĐỒ CHỖ NGỒI (Seatmap)
-- =============================================

CREATE TABLE IF NOT EXISTS seats (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  row_label VARCHAR(10),
  seat_number INTEGER,
  seat_label VARCHAR(20),
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'held', 'booked', 'unavailable')),
  x FLOAT DEFAULT 0,
  y FLOAT DEFAULT 0,
  price DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS zones (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(100),
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
  capacity INTEGER DEFAULT 0,
  sold INTEGER DEFAULT 0,
  x FLOAT DEFAULT 0,
  y FLOAT DEFAULT 0,
  width FLOAT DEFAULT 100,
  height FLOAT DEFAULT 60,
  color VARCHAR(20) DEFAULT '#3498db',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seat_holds (
  id SERIAL PRIMARY KEY,
  seat_id INTEGER REFERENCES seats(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  held_until TIMESTAMP,
  order_id INTEGER,
  status VARCHAR(20) DEFAULT 'held',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 3. THANH TOÁN & ĐƠN HÀNG (Orders & Payments)
-- =============================================

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  order_code VARCHAR(50) UNIQUE NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  commission DECIMAL(12, 2) DEFAULT 0,
  net_amount DECIMAL(12, 2) NOT NULL,
  -- Legacy columns (đồng bộ qua trigger)
  total_price DECIMAL(12, 2),
  platform_fee DECIMAL(12, 2),
  net_revenue DECIMAL(12, 2),
  status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(20) DEFAULT 'vnpay',
  notes TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  transaction_id VARCHAR(100) UNIQUE,
  request_id VARCHAR(100),
  vnpay_trans_id VARCHAR(100) UNIQUE,
  amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  response_code VARCHAR(10),
  message TEXT,
  raw_response JSONB,
  verified_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transaction_logs (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  action VARCHAR(50),
  status VARCHAR(20),
  amount DECIMAL(12, 2),
  previous_status VARCHAR(20),
  new_status VARCHAR(20),
  metadata JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seat_id INTEGER REFERENCES seats(id) ON DELETE SET NULL,
  zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 1,
  quantity_ordered INTEGER,
  unit_price DECIMAL(12, 2) NOT NULL,
  price_at_purchase DECIMAL(12, 2),
  total_price DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  -- E-ticket fields
  encrypted_id VARCHAR(255) UNIQUE,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refunds (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  reason VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  vnpay_refund_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- =============================================
-- 4. VÉ ĐIỆN TỬ & XÁC THỰC (E-Ticket)
-- =============================================

CREATE TABLE IF NOT EXISTS ticket_verification_logs (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  verified_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verification_method VARCHAR(50),
  encrypted_id_scanned VARCHAR(255),
  is_valid BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 5. LỊCH DIỄN NHIỀU NGÀY (Event Schedules)
-- =============================================

CREATE TABLE IF NOT EXISTS event_schedules (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(event_id, schedule_date)
);

CREATE TABLE IF NOT EXISTS schedule_tickets (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES event_schedules(id) ON DELETE CASCADE,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  daily_quantity INTEGER NOT NULL DEFAULT 0,
  daily_sold INTEGER NOT NULL DEFAULT 0,
  UNIQUE(schedule_id, ticket_id)
);

-- =============================================
-- 6. INDEXES (Hiệu năng truy vấn)
-- =============================================

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_category_id ON events(category_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_seats_event_id ON seats(event_id);
CREATE INDEX IF NOT EXISTS idx_zones_event_id ON zones(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_vnpay_trans_id ON payments(vnpay_trans_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seat_id ON order_items(seat_id);
CREATE INDEX IF NOT EXISTS idx_order_items_encrypted_id ON order_items(encrypted_id);
CREATE INDEX IF NOT EXISTS idx_event_schedules_event_id ON event_schedules(event_id);
CREATE INDEX IF NOT EXISTS idx_event_schedules_date ON event_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedule_tickets_schedule ON schedule_tickets(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_tickets_ticket ON schedule_tickets(ticket_id);

-- =============================================
-- 7. TRIGGERS (Đồng bộ column)
-- =============================================

CREATE OR REPLACE FUNCTION sync_orders_columns() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_amount IS NOT NULL THEN NEW.total_price := NEW.total_amount; END IF;
  IF NEW.commission IS NOT NULL THEN NEW.platform_fee := NEW.commission; END IF;
  IF NEW.net_amount IS NOT NULL THEN NEW.net_revenue := NEW.net_amount; END IF;
  IF NEW.total_price IS NOT NULL AND NEW.total_amount IS NULL THEN NEW.total_amount := NEW.total_price; END IF;
  IF NEW.platform_fee IS NOT NULL AND NEW.commission IS NULL THEN NEW.commission := NEW.platform_fee; END IF;
  IF NEW.net_revenue IS NOT NULL AND NEW.net_amount IS NULL THEN NEW.net_amount := NEW.net_revenue; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_orders_columns ON orders;
CREATE TRIGGER trg_sync_orders_columns
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION sync_orders_columns();

CREATE OR REPLACE FUNCTION sync_order_items_columns() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity IS NOT NULL AND NEW.quantity_ordered IS NULL THEN NEW.quantity_ordered := NEW.quantity; END IF;
  IF NEW.quantity_ordered IS NOT NULL AND NEW.quantity IS NULL THEN NEW.quantity := NEW.quantity_ordered; END IF;
  IF NEW.unit_price IS NOT NULL AND NEW.price_at_purchase IS NULL THEN NEW.price_at_purchase := NEW.unit_price; END IF;
  IF NEW.price_at_purchase IS NOT NULL AND NEW.unit_price IS NULL THEN NEW.unit_price := NEW.price_at_purchase; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_order_items_columns ON order_items;
CREATE TRIGGER trg_sync_order_items_columns
  BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION sync_order_items_columns();

-- =============================================
-- 8. SEED DATA CƠ BẢN (Admin + Categories)
-- =============================================

-- Admin account mặc định (password: 123456)
INSERT INTO users (email, password, role) VALUES
  ('admin@titicket.com', '$2b$10$ZxkV9MC5wmhUAVtL8fQGVuvF1XVvFBPTZZMQDYIqkDDrLTs9kSc2q', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Danh mục sự kiện
INSERT INTO categories (name) VALUES
  ('Âm nhạc'), ('Hội thảo'), ('Mỹ thuật'), ('Thể thao'), ('Sân khấu')
ON CONFLICT DO NOTHING;
