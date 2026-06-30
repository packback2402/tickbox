-- =============================================
-- MIGRATION: Phân quyền Admin & Organizer
-- Chạy SQL này trong Neon SQL Editor
-- =============================================

-- 1. Đổi tên cột admin_id → organizer_id trong bảng events
ALTER TABLE events RENAME COLUMN admin_id TO organizer_id;

-- 2. Thêm cột status vào bảng events (pending / published / rejected)
ALTER TABLE events ADD COLUMN status VARCHAR(20) DEFAULT 'published';

-- Tất cả events cũ đều là published
UPDATE events SET status = 'published' WHERE status IS NULL;

-- 3. Tạo bảng organizer_profiles (thông tin bổ sung cho organizer)
CREATE TABLE IF NOT EXISTS organizer_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  org_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Tạo bảng organizer_requests (yêu cầu trở thành đối tác)
CREATE TABLE IF NOT EXISTS organizer_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  org_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending',  -- pending / approved / rejected
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP
);

-- DONE! Sau khi chạy, restart backend.
