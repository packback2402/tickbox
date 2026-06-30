-- Migration: Unify order/order_items column names
-- The payment system (VNPay) uses: total_amount, commission, net_amount, quantity, unit_price
-- The legacy direct-buy routes use: total_price, platform_fee, net_revenue, quantity_ordered, price_at_purchase
-- This migration adds missing columns so BOTH schemas work with existing data.

-- ========= orders table =========
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS net_revenue DECIMAL(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);

-- Backfill: copy new-schema values into old-schema columns (for VNPay orders)
UPDATE orders SET total_price = total_amount WHERE total_price IS NULL AND total_amount IS NOT NULL;
UPDATE orders SET platform_fee = commission WHERE platform_fee IS NULL AND commission IS NOT NULL;
UPDATE orders SET net_revenue = net_amount WHERE net_revenue IS NULL AND net_amount IS NOT NULL;

-- ========= order_items table =========
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quantity_ordered INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price_at_purchase DECIMAL(12,2);

-- Backfill: copy new-schema values into old-schema columns
UPDATE order_items SET quantity_ordered = quantity WHERE quantity_ordered IS NULL AND quantity IS NOT NULL;
UPDATE order_items SET price_at_purchase = unit_price WHERE price_at_purchase IS NULL AND unit_price IS NOT NULL;

-- ========= Create trigger to keep columns in sync =========

-- orders: keep total_price/platform_fee/net_revenue in sync with total_amount/commission/net_amount
CREATE OR REPLACE FUNCTION sync_orders_columns() RETURNS TRIGGER AS $$
BEGIN
  -- Sync new -> old
  IF NEW.total_amount IS NOT NULL AND (NEW.total_price IS NULL OR NEW.total_price != NEW.total_amount) THEN
    NEW.total_price := NEW.total_amount;
  END IF;
  IF NEW.commission IS NOT NULL AND (NEW.platform_fee IS NULL OR NEW.platform_fee != NEW.commission) THEN
    NEW.platform_fee := NEW.commission;
  END IF;
  IF NEW.net_amount IS NOT NULL AND (NEW.net_revenue IS NULL OR NEW.net_revenue != NEW.net_amount) THEN
    NEW.net_revenue := NEW.net_amount;
  END IF;
  -- Sync old -> new
  IF NEW.total_price IS NOT NULL AND NEW.total_amount IS NULL THEN
    NEW.total_amount := NEW.total_price;
  END IF;
  IF NEW.platform_fee IS NOT NULL AND NEW.commission IS NULL THEN
    NEW.commission := NEW.platform_fee;
  END IF;
  IF NEW.net_revenue IS NOT NULL AND NEW.net_amount IS NULL THEN
    NEW.net_amount := NEW.net_revenue;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_orders_columns ON orders;
CREATE TRIGGER trg_sync_orders_columns
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION sync_orders_columns();

-- order_items: keep quantity_ordered/price_at_purchase in sync with quantity/unit_price
CREATE OR REPLACE FUNCTION sync_order_items_columns() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity IS NOT NULL AND NEW.quantity_ordered IS NULL THEN
    NEW.quantity_ordered := NEW.quantity;
  END IF;
  IF NEW.quantity_ordered IS NOT NULL AND NEW.quantity IS NULL THEN
    NEW.quantity := NEW.quantity_ordered;
  END IF;
  IF NEW.unit_price IS NOT NULL AND NEW.price_at_purchase IS NULL THEN
    NEW.price_at_purchase := NEW.unit_price;
  END IF;
  IF NEW.price_at_purchase IS NOT NULL AND NEW.unit_price IS NULL THEN
    NEW.unit_price := NEW.price_at_purchase;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_order_items_columns ON order_items;
CREATE TRIGGER trg_sync_order_items_columns
  BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION sync_order_items_columns();
