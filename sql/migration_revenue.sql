-- Thêm các cột quản lý dòng tiền vào bảng orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS net_revenue NUMERIC DEFAULT 0;

-- Cập nhật hồi tố dữ liệu cũ để tránh biểu đồ trống
-- B1: Tính lại total_price từ chi tiết order_items
UPDATE orders o
SET total_price = COALESCE((
    SELECT SUM(quantity_ordered * price_at_purchase)
    FROM order_items oi
    WHERE oi.order_id = o.id
), 0);

-- B2: Chiết khấu 5% vào platform_fee, phần còn lại vào net_revenue
UPDATE orders
SET platform_fee = total_price * 0.05,
    net_revenue = total_price * 0.95;
