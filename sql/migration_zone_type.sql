-- =============================================
-- MIGRATION: Mixed Mode — Zone Typing
-- Thêm zone_type để phân biệt zone đứng vs zone ngồi (Best Available)
-- =============================================

-- zone_type: 'standing' (đứng) | 'seated' (ngồi, dùng Best Available)
ALTER TABLE venue_zones ADD COLUMN IF NOT EXISTS zone_type VARCHAR(20) DEFAULT 'standing';

-- Thêm rows/cols để lưu trữ metadata lưới ghế của zone ngồi
ALTER TABLE venue_zones ADD COLUMN IF NOT EXISTS grid_rows INTEGER DEFAULT 0;
ALTER TABLE venue_zones ADD COLUMN IF NOT EXISTS grid_cols INTEGER DEFAULT 0;

-- Update existing zones to be standing (backward compatible)
UPDATE venue_zones SET zone_type = 'standing' WHERE zone_type IS NULL;
