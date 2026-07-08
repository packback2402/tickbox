const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { PLATFORM_FEE_RATE, ORGANIZER_SHARE } = require('../config');

// GET /api/admin/users
router.get('/users', auth, admin, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, email, role FROM users ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/admin/organizer-requests
router.get('/organizer-requests', auth, admin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        r.*, 
        u.email as user_email
      FROM organizer_requests r
      JOIN users u ON r.user_id = u.id
      ORDER BY 
        CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
        r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// PUT /api/admin/organizer-requests/:id/approve
router.put('/organizer-requests/:id/approve', auth, admin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    const reqResult = await client.query(
      "SELECT * FROM organizer_requests WHERE id = $1 AND status = 'pending'",
      [id]
    );
    if (reqResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: "Yêu cầu không tồn tại hoặc đã được xử lý!" });
    }
    const request = reqResult.rows[0];

    await client.query(
      "UPDATE users SET role = 'organizer' WHERE id = $1",
      [request.user_id]
    );

    await client.query(
      "INSERT INTO organizer_profiles (user_id, org_name, phone) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET org_name = $2, phone = $3",
      [request.user_id, request.org_name, request.phone]
    );

    await client.query(
      "UPDATE organizer_requests SET status = 'approved', reviewed_at = NOW() WHERE id = $1",
      [id]
    );

    await client.query('COMMIT');
    res.json({ msg: `Đã cấp quyền Organizer cho user #${request.user_id}!` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  } finally {
    client.release();
  }
});

// PUT /api/admin/organizer-requests/:id/reject
router.put('/organizer-requests/:id/reject', auth, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "UPDATE organizer_requests SET status = 'rejected', reviewed_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Yêu cầu không tồn tại hoặc đã được xử lý!" });
    }
    res.json({ msg: "Đã từ chối yêu cầu." });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/admin/pending-events
router.get('/pending-events', auth, admin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        e.*, 
        c.name AS category_name,
        u.email AS creator_email
      FROM events e
      JOIN categories c ON e.category_id = c.id
      JOIN users u ON e.organizer_id = u.id
      WHERE e.status = 'pending'
      ORDER BY e.id DESC
    `);
    const rows = result.rows.map(row => {
      if (row.license_files && typeof row.license_files === 'string') {
        try { row.license_files = JSON.parse(row.license_files); } catch { row.license_files = []; }
      }
      return row;
    });
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// PUT /api/admin/events/:id/approve
router.put('/events/:id/approve', auth, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "UPDATE events SET status = 'published' WHERE id = $1 AND status = 'pending' RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Sự kiện không tồn tại hoặc không ở trạng thái chờ duyệt!" });
    }
    res.json({ msg: "Sự kiện đã được duyệt và xuất bản!", event: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// PUT /api/admin/events/:id/reject
router.put('/events/:id/reject', auth, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "UPDATE events SET status = 'rejected' WHERE id = $1 AND status = 'pending' RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Sự kiện không tồn tại hoặc không ở trạng thái chờ duyệt!" });
    }
    res.json({ msg: "Sự kiện đã bị từ chối.", event: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/admin/all-events
router.get('/all-events', auth, admin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        e.*,
        c.name AS category_name,
        u.email AS creator_email
      FROM events e
      JOIN categories c ON e.category_id = c.id
      JOIN users u ON e.organizer_id = u.id
      ORDER BY e.id DESC
    `);
    const rows = result.rows.map(row => {
      if (row.license_files && typeof row.license_files === 'string') {
        try { row.license_files = JSON.parse(row.license_files); } catch { row.license_files = []; }
      }
      return row;
    });
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/admin/stats
router.get('/stats', auth, admin, async (req, res) => {
  try {
    const { range } = req.query;
    let orderDateFilter = "";
    if (range === '7days') orderDateFilter = " AND o.created_at >= NOW() - INTERVAL '7 days'";
    else if (range === '30days') orderDateFilter = " AND o.created_at >= NOW() - INTERVAL '30 days'";

    const [eventsCount, usersCount, ordersCount, revenueResult, pendingEventsCount, pendingRequestsCount] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM events WHERE status = 'published'`),
      db.query(`SELECT COUNT(*) FROM users WHERE 1=1`),
      db.query(`SELECT COUNT(*) FROM orders o WHERE 1=1 ${orderDateFilter}`),
      db.query(`SELECT COALESCE(SUM(total_price), 0) as total_revenue, COALESCE(SUM(platform_fee), 0) as platform_fee_total, COALESCE(SUM(net_revenue), 0) as net_revenue_total FROM orders o WHERE 1=1 ${orderDateFilter}`),
      db.query(`SELECT COUNT(*) FROM events WHERE status = 'pending'`),
      db.query(`SELECT COUNT(*) FROM organizer_requests WHERE status = 'pending'`)
    ]);

    res.json({
      total_events: parseInt(eventsCount.rows[0].count),
      total_users: parseInt(usersCount.rows[0].count),
      total_orders: parseInt(ordersCount.rows[0].count),
      total_revenue: parseFloat(revenueResult.rows[0].total_revenue),
      platform_fee: parseFloat(revenueResult.rows[0].platform_fee_total),
      net_revenue: parseFloat(revenueResult.rows[0].net_revenue_total),
      pending_events: parseInt(pendingEventsCount.rows[0].count),
      pending_requests: parseInt(pendingRequestsCount.rows[0].count)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/admin/revenue-chart
router.get('/revenue-chart', auth, admin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, 
             COALESCE(SUM(total_price), 0) as total_price,
             COALESCE(SUM(platform_fee), 0) as platform_fee,
             COALESCE(SUM(net_revenue), 0) as net_revenue
      FROM orders 
      WHERE status = 'completed'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
      ORDER BY date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/admin/revenue-events
router.get('/revenue-events', auth, admin, async (req, res) => {
  try {
    const { range } = req.query;
    let orderDateFilter = "";
    if (range === '7days') orderDateFilter = " AND o.created_at >= NOW() - INTERVAL '7 days'";
    else if (range === '30days') orderDateFilter = " AND o.created_at >= NOW() - INTERVAL '30 days'";

    const result = await db.query(`
      SELECT e.id as event_id, e.title as event_title,
             COALESCE(SUM(oi.quantity_ordered), 0) as total_tickets_sold,
             COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase), 0) as total_gmv,
             COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase * ${PLATFORM_FEE_RATE}), 0) as platform_fee,
             COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase * ${ORGANIZER_SHARE}), 0) as net_revenue
      FROM events e
      LEFT JOIN orders o ON o.event_id = e.id AND o.status = 'completed' ${orderDateFilter}
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY e.id, e.title
      ORDER BY e.event_date DESC, e.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/admin/top-organizers
router.get('/top-organizers', auth, admin, async (req, res) => {
  try {
    const { range, limit = 10 } = req.query;
    let dateFilter = '';
    if (range === '7days') dateFilter = " AND o.created_at >= NOW() - INTERVAL '7 days'";
    else if (range === '30days') dateFilter = " AND o.created_at >= NOW() - INTERVAL '30 days'";

    const result = await db.query(`
      SELECT
        u.id AS organizer_id,
        COALESCE(op.org_name, u.email) AS org_name,
        u.email AS organizer_email,
        COUNT(DISTINCT e.id)::INT AS total_events,
        COUNT(DISTINCT CASE WHEN e.status = 'published' THEN e.id END)::INT AS published_events,
        COALESCE(SUM(oi.quantity_ordered), 0)::INT AS tickets_sold,
        COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase), 0) AS total_gmv,
        COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase * ${ORGANIZER_SHARE}), 0) AS organizer_revenue
      FROM users u
      LEFT JOIN organizer_profiles op ON op.user_id = u.id
      LEFT JOIN events e ON e.organizer_id = u.id
      LEFT JOIN orders o ON o.event_id = e.id AND o.status = 'completed' ${dateFilter}
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE u.role = 'organizer'
      GROUP BY u.id, op.org_name, u.email
      ORDER BY total_gmv DESC
      LIMIT $1
    `, [parseInt(limit)]);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/admin/revenue-by-category
router.get('/revenue-by-category', auth, admin, async (req, res) => {
  try {
    const { range } = req.query;
    let orderDateFilter = '';
    if (range === '7days') orderDateFilter = " AND o.created_at >= NOW() - INTERVAL '7 days'";
    else if (range === '30days') orderDateFilter = " AND o.created_at >= NOW() - INTERVAL '30 days'";

    const result = await db.query(`
      SELECT
        c.id AS category_id,
        c.name AS category_name,
        COUNT(DISTINCT e.id)::INT AS total_events,
        COALESCE(SUM(oi.quantity_ordered), 0)::INT AS tickets_sold,
        COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase), 0) AS total_gmv,
        COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase * ${PLATFORM_FEE_RATE}), 0) AS platform_fee
      FROM categories c
      LEFT JOIN events e ON e.category_id = c.id AND e.status = 'published'
      LEFT JOIN orders o ON o.event_id = e.id AND o.status = 'completed' ${orderDateFilter}
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY c.id, c.name
      ORDER BY total_gmv DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/admin/platform-summary
router.get('/platform-summary', auth, admin, async (req, res) => {
  try {
    const periodQuery = async (start, end) => {
      const r = await db.query(`
        SELECT
          COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase), 0) AS gmv,
          COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase * ${PLATFORM_FEE_RATE}), 0) AS platform_fee,
          COALESCE(SUM(oi.quantity_ordered), 0)::INT AS tickets_sold,
          COUNT(DISTINCT o.id)::INT AS total_orders,
          COUNT(DISTINCT o.user_id)::INT AS unique_buyers
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
                     AND o.created_at >= $1 AND o.created_at < $2
      `, [start, end]);
      return r.rows[0];
    };
    const now = new Date();
    const d30ago = new Date(now - 30 * 86400000);
    const d60ago = new Date(now - 60 * 86400000);
    const [curr, prev] = await Promise.all([
      periodQuery(d30ago, now),
      periodQuery(d60ago, d30ago)
    ]);
    const pct = (c, p) => {
      const cv = parseFloat(c), pv = parseFloat(p);
      if (pv === 0) return cv > 0 ? 100 : 0;
      return Math.round(((cv - pv) / pv) * 100);
    };
    res.json({
      current: curr,
      previous: prev,
      trend: {
        gmv_pct: pct(curr.gmv, prev.gmv),
        fee_pct: pct(curr.platform_fee, prev.platform_fee),
        tickets_pct: pct(curr.tickets_sold, prev.tickets_sold),
        orders_pct: pct(curr.total_orders, prev.total_orders),
        buyers_pct: pct(curr.unique_buyers, prev.unique_buyers)
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/admin/payment-methods
router.get('/payment-methods', auth, admin, async (req, res) => {
  try {
    const { range } = req.query;
    let dateFilter = "";
    if (range === '7days') dateFilter = " AND o.created_at >= NOW() - INTERVAL '7 days'";
    else if (range === '30days') dateFilter = " AND o.created_at >= NOW() - INTERVAL '30 days'";

    const result = await db.query(`
      SELECT
        COALESCE(o.payment_method, 'unknown') AS method,
        COUNT(DISTINCT o.id)::INT AS total_orders,
        COALESCE(SUM(o.total_price), 0) AS total_revenue,
        COALESCE(SUM(o.platform_fee), 0) AS platform_fee
      FROM orders o
      WHERE o.status = 'completed' ${dateFilter}
      GROUP BY o.payment_method
      ORDER BY total_revenue DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/admin/tickets-sold-stats
router.get('/tickets-sold-stats', auth, admin, async (req, res) => {
  try {
    const { range } = req.query;
    let dateFilter = "";
    if (range === '7days') dateFilter = " AND o.created_at >= NOW() - INTERVAL '7 days'";
    else if (range === '30days') dateFilter = " AND o.created_at >= NOW() - INTERVAL '30 days'";

    const result = await db.query(`
      SELECT COALESCE(SUM(oi.quantity_ordered), 0)::INT AS total_tickets_sold
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'completed' ${dateFilter}
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/admin/revenue-detailed
router.get('/revenue-detailed', auth, admin, async (req, res) => {
  try {
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
      WHERE e.status = 'published' ${orderDateFilter}
      GROUP BY e.id, e.title, e.event_date, c.name
      ORDER BY e.event_date DESC, e.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/admin/revenue-by-ticket-type
router.get('/revenue-by-ticket-type', auth, admin, async (req, res) => {
  try {
    const { range } = req.query;
    let orderDateFilter = "";
    if (range === '7days') orderDateFilter = " AND o.created_at >= NOW() - INTERVAL '7 days'";
    else if (range === '30days') orderDateFilter = " AND o.created_at >= NOW() - INTERVAL '30 days'";

    const result = await db.query(`
      SELECT 
        t.type as ticket_type,
        e.title as event_title,
        e.id as event_id,
        COALESCE(SUM(oi.quantity_ordered), 0) as quantity_sold,
        COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase), 0) as total_revenue,
        ROUND(COALESCE(AVG(oi.price_at_purchase), 0)::numeric, 0) as avg_price
      FROM tickets t
      LEFT JOIN order_items oi ON t.id = oi.ticket_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.status = 'completed'
      LEFT JOIN events e ON t.event_id = e.id
      WHERE t.type IS NOT NULL ${orderDateFilter}
      GROUP BY t.type, e.title, e.id
      ORDER BY total_revenue DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/admin/revenue-by-hour
router.get('/revenue-by-hour', auth, admin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        EXTRACT(HOUR FROM o.created_at)::INT as hour,
        TO_CHAR(EXTRACT(HOUR FROM o.created_at)::INT, '00'::TEXT) || ':00' as hour_label,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(oi.quantity_ordered), 0) as total_tickets_sold,
        COALESCE(SUM(oi.quantity_ordered * oi.price_at_purchase), 0) as total_revenue,
        ROUND(COALESCE(AVG(oi.price_at_purchase), 0)::numeric, 0) as avg_ticket_price
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status = 'completed'
      GROUP BY EXTRACT(HOUR FROM o.created_at)
      ORDER BY hour ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/admin/event-orders/:event_id
router.get('/event-orders/:event_id', auth, admin, async (req, res) => {
  try {
    const { event_id } = req.params;
    const result = await db.query(`
      SELECT
        o.id             AS order_id,
        o.order_code     AS order_code,
        u.email          AS customer_email,
        SPLIT_PART(u.email, '@', 1) AS customer_name,
        COALESCE(t.type, vz.name, seat_info.section, 'Không rõ') AS ticket_type,
        oi.quantity_ordered,
        oi.price_at_purchase,
        (oi.quantity_ordered * oi.price_at_purchase)        AS subtotal,
        (oi.quantity_ordered * oi.price_at_purchase * ${PLATFORM_FEE_RATE}) AS platform_fee,
        o.created_at     AS purchased_at
      FROM order_items oi
      JOIN orders o    ON o.id = oi.order_id
      JOIN users u     ON u.id = o.user_id
      LEFT JOIN tickets t ON t.id = oi.ticket_id
      LEFT JOIN venue_zones vz ON vz.id = oi.zone_id
      LEFT JOIN seats seat_info ON seat_info.id = oi.seat_id
      WHERE o.event_id = $1
        AND o.status = 'completed'
      ORDER BY o.created_at DESC
      LIMIT 200
    `, [event_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

module.exports = router;
