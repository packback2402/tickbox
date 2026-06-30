-- Migration 008: Rename MoMo references to VNPay
-- Since the project uses only VNPay, rename the legacy momo_trans_id column

ALTER TABLE payments RENAME COLUMN momo_trans_id TO vnpay_trans_id;
ALTER INDEX IF EXISTS idx_payments_momo_trans_id RENAME TO idx_payments_vnpay_trans_id;

-- Update any existing MOMO_MOCK-related data in the comment for documentation
COMMENT ON COLUMN payments.vnpay_trans_id IS 'Transaction ID from VNPay';
