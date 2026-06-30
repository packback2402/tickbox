-- Migration 010: Add event settings columns (payment info + license info)
-- Step 4 "Cài đặt" data

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS bank_account_holder  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bank_account_number  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_name            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_branch          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS want_invoice         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS invoice_business_type VARCHAR(20) DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS invoice_full_name    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS invoice_company_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS invoice_tax_code     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS invoice_address      TEXT,
  ADD COLUMN IF NOT EXISTS license_note         TEXT;
