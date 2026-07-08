const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { PLATFORM_FEE_RATE, ORGANIZER_SHARE } = require('../config');

// Middleware kiểm tra quyền organizer hoặc admin
const requireOrganizerOrAdmin = (req, res, next) => {
  if (req.user.role !== 'organizer' && req.user.role !== 'admin') {
    return res.status(403).json({ msg: "Không có quyền!" });
  }
  next();
};

// GET /api/organizer/my-events
router.get('/my-events', auth, requireOrganizerOrAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        e.*,
        c.name AS category_name,
        COALESCE(sales.tickets_sold, 0)::INT AS tickets_sold,
        COALESCE(sales.revenue, 0)::NUMERIC AS revenue,
        (COALESCE(capacity.tickets_remaining_and_held, 0) + COALESCE(sales.tickets_sold, 0))::INT AS tickets_total
      FROM events e
      JOIN categories c ON e.category_id = c.id
      LEFT JOIN (
        SELECT t.event_id,
               SUM(oi.quantity_ordered) AS tickets_sold,
               SUM(oi.quantity_ordered * oi.price_at_purchase) AS revenue
        FROM order_items oi
        JOIN tickets t ON t.id = oi.ticket_id
        JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
        GROUP BY t.event_id
      ) sales ON sales.event_id = e.id
      LEFT JOIN (
        SELECT event_id, SUM(quantity_available + quantity_held) AS tickets_remaining_and_held
        FROM tickets
        GROUP BY event_id
      ) capacity ON capacity.event_id = e.id
      WHERE e.organizer_id = $1
      ORDER BY e.id DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/organizer/stats
router.get('/stats', auth, requireOrganizerOrAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    const { range } = req.query;
    let orderDateFilter = "";
    if (range === '7days') orderDateFilter = " AND o.created_at >= NOW() - INTERVAL '7 days'";
    else if (range === '30days') orderDateFilter = " AND o.created_at >= NOW() - INTERVAL '30 days'";

    const [eventsCount, revenueResult, ticketsSold, ticketsTotal] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM events WHERE organizer_id = $1`, [userId]),
      db.query(`
        SELECT COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase), 0) as total_revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN events e ON o.event_id = e.id
        WHERE e.organizer_id = $1 AND o.status = 'completed' ${orderDateFilter}
      `, [userId]),
      db.query(`
        SELECT COALESCE(SUM(oi.quantity_ordered), 0) as total_sold
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN events e ON o.event_id = e.id
        WHERE e.organizer_id = $1 AND o.status = 'completed' ${orderDateFilter}
      `, [userId]),
      db.query(`
        SELECT COALESCE(SUM(t.quantity_available), 0) as total_remaining
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        WHERE e.organizer_id = $1
      `, [userId])
    ]);

    const sold = parseInt(ticketsSold.rows[0].total_sold);
    const remaining = parseInt(ticketsTotal.rows[0].total_remaining);
    const total = sold + remaining;

    res.json({
      total_events: parseInt(eventsCount.rows[0].count),
      total_revenue: parseFloat(revenueResult.rows[0].total_revenue),
      total_tickets_sold: sold,
      sell_through_rate: total > 0 ? Math.round((sold / total) * 100) : 0
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/organizer/revenue-chart
router.get('/revenue-chart', auth, requireOrganizerOrAdmin, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(`
      SELECT 
        TO_CHAR(o.created_at, 'YYYY-MM') as month,
        SUM(oi.quantity_ordered * oi.price_at_purchase) as revenue,
        SUM(oi.quantity_ordered) as tickets_sold
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id AND o.status = 'completed'
      JOIN events e ON o.event_id = e.id
      WHERE e.organizer_id = $1 
        AND o.created_at >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(o.created_at, 'YYYY-MM')
      ORDER BY month ASC
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/organizer/ticket-stats/:event_id
router.get('/ticket-stats/:event_id', auth, requireOrganizerOrAdmin, async (req, res) => {
  try {
    const { event_id } = req.params;

    if (req.user.role === 'organizer') {
      const check = await db.query("SELECT organizer_id FROM events WHERE id = $1", [event_id]);
      if (check.rows.length === 0 || check.rows[0].organizer_id !== req.user.id) {
        return res.status(403).json({ msg: "Không có quyền xem sự kiện này!" });
      }
    }

    const result = await db.query(`
      SELECT 
        t.type,
        t.price,
        t.quantity_available as remaining,
        COALESCE(SUM(oi.quantity_ordered), 0) as sold
      FROM tickets t
      LEFT JOIN order_items oi ON t.id = oi.ticket_id
      WHERE t.event_id = $1
      GROUP BY t.id, t.type, t.price, t.quantity_available
      ORDER BY t.price ASC
    `, [event_id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/organizer/revenue-detailed
router.get('/revenue-detailed', auth, requireOrganizerOrAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    const { range } = req.query;
    let orderDateFilter = "";
    if (range === '7days') orderDateFilter = " AND o.created_at >= NOW() - INTERVAL '7 days'";
    else if (range === '30days') orderDateFilter = " AND o.created_at >= NOW() - INTERVAL '30 days'";

    const result = await db.query(`
      SELECT 
        e.id as event_id,
        e.title as event_title,
        e.event_date,
        c.name as category_name,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(oi.quantity_ordered), 0) as total_tickets_sold,
        COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase), 0) as total_revenue,
        COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase * ${PLATFORM_FEE_RATE}), 0) as platform_fee,
        COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase * ${ORGANIZER_SHARE}), 0) as net_revenue,
        ROUND(COALESCE(AVG(oi.price_at_purchase), 0)::numeric, 0) as avg_ticket_price
      FROM events e
      LEFT JOIN categories c ON e.category_id = c.id
      LEFT JOIN orders o ON o.event_id = e.id AND o.status = 'completed'
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE e.organizer_id = $1 ${orderDateFilter}
      GROUP BY e.id, e.title, e.event_date, c.name
      ORDER BY e.event_date DESC
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/organizer/revenue-by-ticket-type/:event_id
router.get('/revenue-by-ticket-type/:event_id', auth, requireOrganizerOrAdmin, async (req, res) => {
  try {
    const { event_id } = req.params;

    if (req.user.role === 'organizer') {
      const check = await db.query("SELECT organizer_id FROM events WHERE id = $1", [event_id]);
      if (check.rows.length === 0 || check.rows[0].organizer_id !== req.user.id) {
        return res.status(403).json({ msg: "Không có quyền xem sự kiện này!" });
      }
    }

    const result = await db.query(`
      SELECT
        t.id          AS ticket_id,
        t.type        AS ticket_type,
        t.price       AS unit_price,
        t.quantity_available AS quantity_total,
        COALESCE(SUM(
          CASE
            WHEN oi.ticket_id = t.id THEN oi.quantity_ordered          -- direct ticket purchase
            WHEN oi.seat_id IS NOT NULL AND s.section = t.type THEN 1  -- seatmap seat matching section
            ELSE 0
          END
        ), 0)::INT    AS quantity_sold,
        t.quantity_available AS quantity_remaining,
        COALESCE(SUM(
          CASE
            WHEN oi.ticket_id = t.id THEN oi.quantity_ordered * oi.price_at_purchase
            WHEN oi.seat_id IS NOT NULL AND s.section = t.type THEN oi.price_at_purchase
            ELSE 0
          END
        ), 0)         AS total_revenue
      FROM tickets t
      LEFT JOIN order_items oi ON (
        oi.ticket_id = t.id
        OR (oi.seat_id IS NOT NULL AND (
          SELECT section FROM seats WHERE id = oi.seat_id
        ) = t.type AND (
          SELECT event_id FROM orders WHERE id = oi.order_id
        ) = t.event_id)
      )
      LEFT JOIN seats s ON s.id = oi.seat_id
      LEFT JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
      WHERE t.event_id = $1
        AND (oi.order_id IS NULL OR o.id IS NOT NULL)
      GROUP BY t.id, t.type, t.price, t.quantity_available
      ORDER BY t.price DESC
    `, [event_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/organizer/revenue-by-hour/:event_id
router.get('/revenue-by-hour/:event_id', auth, requireOrganizerOrAdmin, async (req, res) => {
  try {
    const { event_id } = req.params;

    if (req.user.role === 'organizer') {
      const check = await db.query("SELECT organizer_id FROM events WHERE id = $1", [event_id]);
      if (check.rows.length === 0 || check.rows[0].organizer_id !== req.user.id) {
        return res.status(403).json({ msg: "Không có quyền xem sự kiện này!" });
      }
    }

    const result = await db.query(`
      SELECT 
        EXTRACT(HOUR FROM o.created_at)::INT as hour,
        TO_CHAR(EXTRACT(HOUR FROM o.created_at)::INT, '00'::TEXT) || ':00' as hour_label,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(oi.quantity_ordered), 0) as total_tickets_sold,
        COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase), 0) as total_revenue,
        ROUND(COALESCE(AVG(oi.price_at_purchase), 0)::numeric, 0) as avg_ticket_price
      FROM events e
      LEFT JOIN orders o ON o.event_id = e.id AND o.status = 'completed'
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE e.id = $1
      GROUP BY EXTRACT(HOUR FROM o.created_at)
      ORDER BY hour ASC
    `, [event_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/organizer/revenue-by-category
router.get('/revenue-by-category', auth, requireOrganizerOrAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    const { range } = req.query;
    let orderDateFilter = "";
    if (range === '7days') orderDateFilter = " AND o.created_at >= NOW() - INTERVAL '7 days'";
    else if (range === '30days') orderDateFilter = " AND o.created_at >= NOW() - INTERVAL '30 days'";

    const result = await db.query(`
      SELECT 
        c.name as category_name,
        COALESCE(SUM(oi.quantity_ordered), 0) as total_sold,
        COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase), 0) as total_revenue
      FROM events e
      JOIN categories c ON e.category_id = c.id
      LEFT JOIN orders o ON o.event_id = e.id AND o.status = 'completed' ${orderDateFilter}
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE e.organizer_id = $1
      GROUP BY c.name
      ORDER BY total_revenue DESC
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/organizer/event-revenue-timeline/:id
router.get('/event-revenue-timeline/:id', auth, requireOrganizerOrAdmin, async (req, res) => {
  try {
    const eventId = req.params.id;
    if (req.user.role === 'organizer') {
      const check = await db.query("SELECT organizer_id FROM events WHERE id = $1", [eventId]);
      if (check.rows.length === 0 || check.rows[0].organizer_id !== req.user.id) {
        return res.status(403).json({ msg: "Không có quyền xem sự kiện này!" });
      }
    }

    const result = await db.query(`
      SELECT 
        TO_CHAR(o.created_at, 'YYYY-MM-DD') as date,
        COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase), 0) as revenue
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.event_id = $1 AND o.status = 'completed'
      GROUP BY TO_CHAR(o.created_at, 'YYYY-MM-DD')
      ORDER BY date ASC
    `, [eventId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/organizer/event-attendees/:event_id
router.get('/event-attendees/:event_id', auth, requireOrganizerOrAdmin, async (req, res) => {
  try {
    const { event_id } = req.params;
    if (req.user.role === 'organizer') {
      const check = await db.query("SELECT organizer_id FROM events WHERE id = $1", [event_id]);
      if (check.rows.length === 0 || check.rows[0].organizer_id !== req.user.id) {
        return res.status(403).json({ msg: "Không có quyền xem sự kiện này!" });
      }
    }
    const result = await db.query(`
      SELECT
        o.id            AS order_id,
        o.order_code    AS order_code,
        u.email         AS customer_email,
        COALESCE(u.full_name, SPLIT_PART(u.email, '@', 1)) AS customer_name,
        COALESCE(
          t.type,
          vz.name,
          s.section,
          'Vé sự kiện'
        )               AS ticket_type,
        oi.quantity_ordered,
        oi.price_at_purchase,
        (oi.quantity_ordered * oi.price_at_purchase) AS subtotal,
        o.created_at    AS purchased_at
      FROM order_items oi
      JOIN orders o           ON o.id = oi.order_id
      JOIN users u            ON u.id = o.user_id
      LEFT JOIN tickets t     ON t.id = oi.ticket_id
      LEFT JOIN venue_zones vz ON vz.id = oi.zone_id
      LEFT JOIN seats s       ON s.id = oi.seat_id
      WHERE o.event_id = $1
        AND o.status = 'completed'
      ORDER BY o.created_at DESC
    `, [event_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/organizer/event-summary/:event_id
router.get('/event-summary/:event_id', auth, requireOrganizerOrAdmin, async (req, res) => {
  try {
    const { event_id } = req.params;
    if (req.user.role === 'organizer') {
      const check = await db.query("SELECT organizer_id FROM events WHERE id = $1", [event_id]);
      if (check.rows.length === 0 || check.rows[0].organizer_id !== req.user.id) {
        return res.status(403).json({ msg: "Không có quyền xem sự kiện này!" });
      }
    }
    const [eventRes, salesRes, capacityRes, uniqueRes] = await Promise.all([
      db.query(`
        SELECT e.title, e.event_date, e.location, e.status, c.name AS category_name
        FROM events e JOIN categories c ON c.id = e.category_id
        WHERE e.id = $1
      `, [event_id]),
      db.query(`
        SELECT
          COALESCE(SUM(oi.quantity_ordered), 0)::INT AS tickets_sold,
          COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase), 0) AS total_revenue,
          COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase * ${ORGANIZER_SHARE}), 0) AS net_revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
        WHERE o.event_id = $1
      `, [event_id]),
      db.query(`
        SELECT COALESCE(SUM(quantity_available + quantity_held), 0)::INT AS tickets_remaining_and_held
        FROM tickets WHERE event_id = $1
      `, [event_id]),
      db.query(`
        SELECT COUNT(DISTINCT o.user_id)::INT AS unique_customers
        FROM orders o
        WHERE o.event_id = $1 AND o.status = 'completed'
      `, [event_id])
    ]);
    if (eventRes.rows.length === 0) return res.status(404).json({ msg: "Không tìm thấy sự kiện" });
    const event = eventRes.rows[0];
    const sales = salesRes.rows[0];
    const ticketsSold = parseInt(sales.tickets_sold);
    const ticketsTotal = parseInt(capacityRes.rows[0].tickets_remaining_and_held) + ticketsSold;
    res.json({
      ...event,
      tickets_sold: ticketsSold,
      tickets_total: ticketsTotal,
      sell_through_rate: ticketsTotal > 0 ? Math.round((ticketsSold / ticketsTotal) * 100) : 0,
      total_revenue: parseFloat(sales.total_revenue),
      net_revenue: parseFloat(sales.net_revenue),
      unique_customers: parseInt(uniqueRes.rows[0].unique_customers)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/organizer/stats-trend
router.get('/stats-trend', auth, requireOrganizerOrAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    const trendQuery = async (filter) => {
      const r = await db.query(`
        SELECT
          COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase), 0) AS revenue,
          COALESCE(SUM(oi.quantity_ordered), 0)::INT AS tickets_sold,
          COUNT(DISTINCT o.id)::INT AS orders
        FROM order_items oi
        JOIN orders o  ON o.id = oi.order_id AND o.status = 'completed'
        JOIN events e  ON e.id = o.event_id
        WHERE e.organizer_id = $1 ${filter}
      `, [userId]);
      return r.rows[0];
    };
    const [curr30, prev30] = await Promise.all([
      trendQuery("AND o.created_at >= NOW() - INTERVAL '30 days'"),
      trendQuery("AND o.created_at >= NOW() - INTERVAL '60 days' AND o.created_at < NOW() - INTERVAL '30 days'")
    ]);
    const pct = (curr, prev) => {
      const c = parseFloat(curr), p = parseFloat(prev);
      if (p === 0) return c > 0 ? 100 : 0;
      return Math.round(((c - p) / p) * 100);
    };
    res.json({
      current: curr30,
      previous: prev30,
      trend: {
        revenue_pct: pct(curr30.revenue, prev30.revenue),
        tickets_pct: pct(curr30.tickets_sold, prev30.tickets_sold),
        orders_pct:  pct(curr30.orders,  prev30.orders)
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

module.exports = router;
