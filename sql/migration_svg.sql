-- =============================================
-- MIGRATION: Nâng cấp Sơ đồ SVG Không Gian (Spatial UI)
-- =============================================

-- 1. Thể hiện chuỗi chứa node đồ hoạ SVG cho sự kiện
ALTER TABLE events ADD COLUMN IF NOT EXISTS svg_layout TEXT;

-- 2. Thêm khóa nối từ node Path trong SVG vào dữ liệu khu vực
ALTER TABLE venue_zones ADD COLUMN IF NOT EXISTS svg_id VARCHAR(100);
