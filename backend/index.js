require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const db         = require('./db');
const { startExpireOrdersJob } = require('./jobs/expireOrders');

// Router imports
const paymentRoutes          = require('./routes/payments');
const authRoutes             = require('./routes/auth');
const categoriesRoutes       = require('./routes/categories');
const eventsRoutes           = require('./routes/events');
const eventSchedulesRoutes   = require('./routes/event-schedules');
const ticketsRoutes          = require('./routes/tickets');
const ordersRoutes           = require('./routes/orders');
const organizerRequestsRoutes = require('./routes/organizer-requests');
const adminRoutes            = require('./routes/admin');
const organizerRoutes        = require('./routes/organizer');
const seatmapRoutes          = require('./routes/seatmap');
const queueRoutes            = require('./routes/queue');

// Đảm bảo thư mục uploads tồn tại
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();

// CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://ticketbox-frontend.vercel.app',
];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Static files
app.use('/uploads', express.static(UPLOADS_DIR));

// Mount routers
app.use('/api/payments',            paymentRoutes);
app.use('/api',                     authRoutes);
app.use('/api/categories',          categoriesRoutes);
app.use('/api/events',              eventsRoutes);
app.use('/api/event-schedules',     eventSchedulesRoutes);
app.use('/api/tickets',             ticketsRoutes);
app.use('/api/orders',              ordersRoutes);
app.use('/api/organizer-requests',  organizerRequestsRoutes);
app.use('/api/admin',               adminRoutes);
app.use('/api/organizer',           organizerRoutes);
app.use('/api',                     seatmapRoutes);
app.use('/api/queue',               queueRoutes);

// Dev-only: Queue test helpers
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/dev/queue/seed', async (req, res) => {
    const { event_id } = req.body;
    if (!event_id) return res.status(400).json({ msg: 'Thiếu event_id' });
    try {
      await db.query(`DELETE FROM purchase_queue WHERE event_id = $1 AND user_id = 99999`, [event_id]);
      await db.query(
        `INSERT INTO purchase_queue (event_id, user_id, queue_number, status, ticket_data, expires_at)
         VALUES ($1, 99999, 1, 'waiting', '{"fake":true}', NOW() + INTERVAL '30 minutes')`,
        [event_id]
      );
      res.json({ success: true, msg: `Đã tạo fake queue entry cho event ${event_id}` });
    } catch (err) {
      res.status(500).json({ msg: err.message });
    }
  });

  app.delete('/api/dev/queue/clear', async (req, res) => {
    const { event_id } = req.body;
    if (!event_id) return res.status(400).json({ msg: 'Thiếu event_id' });
    try {
      await db.query(`DELETE FROM purchase_queue WHERE event_id = $1 AND user_id = 99999`, [event_id]);
      res.json({ success: true, msg: `Đã xóa fake queue entry. User thật sẽ tiến lên position 0.` });
    } catch (err) {
      res.status(500).json({ msg: err.message });
    }
  });
}

// Background job: dọn dẹp seat holds hết hạn (mỗi 60 giây)
setInterval(async () => {
  try {
    const result = await db.query(`
      UPDATE seats SET status = 'available'
      WHERE id IN (
        SELECT seat_id FROM seat_holds WHERE expires_at < NOW()
      ) AND status = 'held'
      RETURNING id
    `);
    await db.query("DELETE FROM seat_holds WHERE expires_at < NOW()");

    if (result.rows.length > 0) {
      console.log(`[Cleanup] Giải phóng ${result.rows.length} ghế hết hạn hold`);
    }

    const expiredQueue = await db.query(
      "DELETE FROM purchase_queue WHERE expires_at < NOW() RETURNING id"
    );
    if (expiredQueue.rows.length > 0) {
      console.log(`[Cleanup] Xóa ${expiredQueue.rows.length} queue entry hết hạn`);
    }
  } catch (err) {
    // Silent fail — job sẽ retry lần sau
  }
}, 60 * 1000);

// Health check
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'db_error', error: err.message });
  }
});

// Root
app.get('/', (_req, res) => {
  res.send('Chào mừng đến với Backend API TiTicket!');
});

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startExpireOrdersJob();
});
