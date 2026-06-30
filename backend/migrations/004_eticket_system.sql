-- E-Ticket System Migration
-- Created: May 2024
-- Adds support for ticket verification and usage tracking

-- Add columns to order_items for e-ticket tracking
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS used_at TIMESTAMP;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS qr_code_generated_at TIMESTAMP;

-- Add index for status checks
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);
CREATE INDEX IF NOT EXISTS idx_order_items_used_at ON order_items(used_at);

-- Add column to orders for email tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_status VARCHAR(20) DEFAULT 'pending'; -- pending, sent, failed

-- Create ticket_verification_logs table for audit trail
CREATE TABLE IF NOT EXISTS ticket_verification_logs (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  verified_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verification_method VARCHAR(50), -- qr_scan, manual, api
  encrypted_id_scanned VARCHAR(255),
  is_valid BOOLEAN DEFAULT true,
  metadata JSONB, -- Store venue info, timestamp, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for verification logs
CREATE INDEX IF NOT EXISTS idx_ticket_verification_logs_order_item_id 
  ON ticket_verification_logs(order_item_id);
CREATE INDEX IF NOT EXISTS idx_ticket_verification_logs_event_id 
  ON ticket_verification_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_verification_logs_created_at 
  ON ticket_verification_logs(created_at);

-- Update order_items status enum if using check constraint (optional)
-- This ensures we have the right statuses
-- ALTER TABLE order_items ADD CONSTRAINT check_status_valid 
-- CHECK (status IN ('pending', 'confirmed', 'used', 'cancelled'));
