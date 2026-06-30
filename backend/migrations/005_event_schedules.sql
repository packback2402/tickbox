-- =============================================
-- MIGRATION: Lịch diễn cho sự kiện nhiều ngày
-- Chạy SQL này trong Neon SQL Editor
-- =============================================

-- Bảng lưu lịch diễn từng ngày cho sự kiện nhiều ngày (triển lãm, lễ hội...)
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

-- Index để query nhanh
CREATE INDEX IF NOT EXISTS idx_event_schedules_event_id ON event_schedules(event_id);
CREATE INDEX IF NOT EXISTS idx_event_schedules_date ON event_schedules(schedule_date);

-- DONE! Sau khi chạy, restart backend.
