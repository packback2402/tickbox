-- Migration: Fix order_items table — add ticket_id column
-- Required by payment flow when purchasing ticket-catalog items
-- Created: 2026-05-03

-- Add ticket_id column to order_items if not already present
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL;

-- Add index for quick lookup
CREATE INDEX IF NOT EXISTS idx_order_items_ticket_id ON order_items(ticket_id);

-- Ensure at least one of seat_id, zone_id, ticket_id is set (optional constraint)
-- Uncomment the line below if you want DB-level validation:
-- ALTER TABLE order_items ADD CONSTRAINT chk_order_item_ref
--   CHECK (seat_id IS NOT NULL OR zone_id IS NOT NULL OR ticket_id IS NOT NULL);
