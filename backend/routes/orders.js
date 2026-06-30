const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { PLATFORM_FEE_RATE, ORGANIZER_SHARE } = require('../config');

// GET /api/orders/mine
router.get('/mine', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Đơn hàng vé thường (ticket-based)
    const newOrdersQuery = `
      SELECT 
        o.id as order_id,
        o.order_code,
        oi.id as order_item_id,
        o.created_at as order_date,
        o.status as order_status,
        oi.status as item_status,
        e.title as event_title,
        e.event_date,
        e.location,
        e.image_url,
        t.type as ticket_type,
        COALESCE(oi.unit_price, oi.price_at_purchase, t.price) as price,
        1 as quantity,
        s.sub_index
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN tickets t ON oi.ticket_id = t.id
      JOIN events e ON t.event_id = e.id
      CROSS JOIN LATERAL generate_series(1, COALESCE(oi.quantity, oi.quantity_ordered, 1)) as s(sub_index)
      WHERE o.user_id = $1 AND o.status = 'completed' AND oi.ticket_id IS NOT NULL
    `;

    // Đơn hàng ghế ngồi (seat-based)
    const seatOrdersQuery = `
      SELECT 
        o.id as order_id,
        o.order_code,
        oi.id as order_item_id,
        o.created_at as order_date,
        o.status as order_status,
        oi.status as item_status,
        e.title as event_title,
        e.event_date,
        e.location,
        e.image_url,
        'Ghế ' || s.section || '-' || s.row_label || s.seat_number::text as ticket_type,
        COALESCE(oi.unit_price, s.price, 0) as price,
        1 as quantity,
        1 as sub_index
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN seats s ON oi.seat_id = s.id
      JOIN events e ON o.event_id = e.id
      WHERE o.user_id = $1 AND o.status = 'completed' AND oi.seat_id IS NOT NULL
    `;

    // Đơn hàng vé khu vực (zone-based)
    const zoneOrdersQuery = `
      SELECT 
        o.id as order_id,
        o.order_code,
        oi.id as order_item_id,
        o.created_at as order_date,
        o.status as order_status,
        oi.status as item_status,
        e.title as event_title,
        e.event_date,
        e.location,
        e.image_url,
        COALESCE(vz.name, 'Vé khu vực') as ticket_type,
        COALESCE(oi.unit_price, vz.price, 0) as price,
        1 as quantity,
        s.sub_index
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN venue_zones vz ON oi.zone_id = vz.id
      JOIN events e ON o.event_id = e.id
      CROSS JOIN LATERAL generate_series(1, COALESCE(oi.quantity, 1)) as s(sub_index)
      WHERE o.user_id = $1 AND o.status = 'completed' AND oi.zone_id IS NOT NULL
    `;

    const [newOrders, seatOrders, zoneOrders] = await Promise.all([
      db.query(newOrdersQuery, [userId]),
      db.query(seatOrdersQuery, [userId]),
      db.query(zoneOrdersQuery, [userId])
    ]);

    const allOrders = [...newOrders.rows, ...seatOrders.rows, ...zoneOrders.rows]
      .sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

    res.json(allOrders);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Lỗi Server');
  }
});

// POST /api/orders — Legacy order (không qua VNPay)
router.post('/', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { ticket_id, quantity } = req.body;
    const user_id = req.user.id;
    const MAX_TICKET_PER_USER = 2;

    await client.query('BEGIN');

    const historyQuery = `
      SELECT SUM(oi.quantity_ordered) as total_bought
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.user_id = $1 AND oi.ticket_id = $2
    `;
    const historyRes = await client.query(historyQuery, [user_id, ticket_id]);
    const currentBought = parseInt(historyRes.rows[0].total_bought) || 0;

    if (currentBought + quantity > MAX_TICKET_PER_USER) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        msg: `Bạn đã mua ${currentBought} vé trước đó. Giới hạn tối đa là ${MAX_TICKET_PER_USER} vé/người.`
      });
    }

    const ticketRes = await client.query(
      "SELECT * FROM tickets WHERE id = $1 FOR UPDATE",
      [ticket_id]
    );

    if (ticketRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: "Vé không tồn tại!" });
    }

    const ticket = ticketRes.rows[0];

    if (ticket.quantity_available < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: "Không đủ số lượng vé trong kho!" });
    }
    await client.query(
      "UPDATE tickets SET quantity_available = quantity_available - $1 WHERE id = $2",
      [quantity, ticket_id]
    );
    const total_price = quantity * ticket.price;
    const platform_fee = total_price * PLATFORM_FEE_RATE;
    const net_revenue = total_price * ORGANIZER_SHARE;

    const orderRes = await client.query(
      "INSERT INTO orders (user_id, event_id, status, total_price, platform_fee, net_revenue) VALUES ($1, $2, 'completed', $3, $4, $5) RETURNING id",
      [user_id, ticket.event_id, total_price, platform_fee, net_revenue]
    );
    const order_id = orderRes.rows[0].id;
    await client.query(
      "INSERT INTO order_items (order_id, ticket_id, quantity_ordered, price_at_purchase) VALUES ($1, $2, $3, $4)",
      [order_id, ticket_id, quantity, ticket.price]
    );

    await client.query('COMMIT');
    res.status(201).json({ msg: "Đặt vé thành công!", order_id: order_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send("Lỗi Server khi đặt vé");
  } finally {
    client.release();
  }
});

module.exports = router;
