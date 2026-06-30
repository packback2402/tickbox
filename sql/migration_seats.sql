-- =============================================
-- MIGRATION: Sơ đồ chỗ ngồi tương tác
-- Hỗ trợ 2 mô hình: Zone-based & Seat-based
-- =============================================

-- 1. Thêm cột vào bảng events
ALTER TABLE events ADD COLUMN IF NOT EXISTS has_seatmap BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS seatmap_type VARCHAR(20) DEFAULT 'seat';
-- seatmap_type: 'zone' (concert/lễ hội) hoặc 'seat' (nhà hát/rạp)

-- 2. Bảng venue_zones — cho mô hình Zone-based (GA, VIP zone...)
CREATE TABLE IF NOT EXISTS venue_zones (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#4A90D9',
  price DECIMAL(12,2) NOT NULL,
  capacity INTEGER NOT NULL,
  sold INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(event_id, name)
);

-- 3. Bảng seats — cho mô hình Seat-based (ghế cụ thể)
CREATE TABLE IF NOT EXISTS seats (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  section VARCHAR(50) NOT NULL,
  row_label VARCHAR(10) NOT NULL,
  seat_number INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'available',
  price DECIMAL(12,2),
  UNIQUE(event_id, section, row_label, seat_number)
);

-- 4. Bảng seat_holds — giữ chỗ tạm (chống Race Condition)
CREATE TABLE IF NOT EXISTS seat_holds (
  id SERIAL PRIMARY KEY,
  seat_id INTEGER REFERENCES seats(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  held_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  UNIQUE(seat_id)
);

-- 5. Indexes tối ưu performance
CREATE INDEX IF NOT EXISTS idx_seats_event_status ON seats(event_id, status);
CREATE INDEX IF NOT EXISTS idx_seat_holds_expires ON seat_holds(expires_at);
CREATE INDEX IF NOT EXISTS idx_zones_event ON venue_zones(event_id);
CREATE INDEX IF NOT EXISTS idx_seats_event_section ON seats(event_id, section);
