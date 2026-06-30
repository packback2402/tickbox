-- Migration 003: Align order_items and orders tables with payment flow requirements
-- Created: 2026-05-03

-- 1. Add seat_id, zone_id to order_items (currently only has ticket_id)
--    ticket_id stays but becomes nullable (seat/zone orders have no ticket_id)
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS seat_id INTEGER REFERENCES seats(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS total_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS quantity INTEGER;

-- 2. Make ticket_id nullable (it was NOT NULL, but seat orders don't have ticket_id)
ALTER TABLE order_items
  ALTER COLUMN ticket_id DROP NOT NULL;

-- Rename old columns to match new names (backwards compatible via aliases if needed)
-- quantity_ordered → quantity (already added above, handle existing data)
-- price_at_purchase → unit_price (already added above)

-- Copy existing data into new columns
UPDATE order_items
  SET quantity = quantity_ordered,
      unit_price = price_at_purchase,
      total_price = price_at_purchase * quantity_ordered,
      status = 'confirmed'
  WHERE quantity IS NULL OR unit_price IS NULL;

-- 3. Add total_amount column to orders (currently only has total_price)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2);

-- Copy total_price → total_amount for existing rows
UPDATE orders SET total_amount = total_price WHERE total_amount IS NULL;

-- 4. Add sold_at column to seats if not present
ALTER TABLE seats
  ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP;

-- 5. Ensure indexes
CREATE INDEX IF NOT EXISTS idx_order_items_seat_id ON order_items(seat_id);
CREATE INDEX IF NOT EXISTS idx_order_items_zone_id ON order_items(zone_id);
