const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// POST /api/queue/join
router.post('/join', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const userId = req.user.id;
    const { event_id, ticket_data } = req.body;

    if (!event_id) {
      return res.status(400).json({ msg: 'Thiếu event_id' });
    }

    // 🧪 TEST MODE: Chỉ giả lập cho đúng event_id được cấu hình
    const testEventId = parseInt(process.env.TEST_QUEUE_EVENT_ID);
    const isTestTarget = testEventId && event_id === testEventId;

    await client.query('BEGIN');

    // Xóa entry cũ của user này (cho phép re-queue)
    await client.query(
      "DELETE FROM purchase_queue WHERE user_id = $1 AND event_id = $2",
      [userId, event_id]
    );

    // Đếm số người đang 'waiting' (= những người sẽ đứng trước mình)
    const posRes = await client.query(
      "SELECT COUNT(*) AS cnt FROM purchase_queue WHERE event_id = $1 AND status = 'waiting'",
      [event_id]
    );
    let position = parseInt(posRes.rows[0].cnt);

    // Giả lập 100 người chờ nếu đúng target và đang trống
    if (isTestTarget && position === 0) {
      position = 100;
    }

    // Nếu position = 0 → không ai đang chờ → cho vào thẳng
    if (position === 0) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        queue_number: 0,
        position: 0,
        estimated_wait_seconds: 0,
        entered_at: new Date(),
        event_id,
      });
    }

    // Có người trước → lấy queue_number tiếp theo và insert vào hàng chờ
    const maxRes = await client.query(
      "SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_num FROM purchase_queue WHERE event_id = $1",
      [event_id]
    );
    const queueNumber = maxRes.rows[0].next_num;

    const insertRes = await client.query(
      `INSERT INTO purchase_queue (event_id, user_id, queue_number, status, ticket_data, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '20 minutes')
       RETURNING id, queue_number, entered_at`,
      [event_id, userId, queueNumber, 'waiting', JSON.stringify(ticket_data || {})]
    );
    const entry = insertRes.rows[0];

    await client.query('COMMIT');

    const estimatedWaitSeconds = position * 180;
    // Nếu là test target: hiển thị queue_number giả (+100) để match với position
    const displayQueueNumber = isTestTarget ? entry.queue_number + 100 : entry.queue_number;

    res.json({
      success: true,
      queue_number: displayQueueNumber,
      position,
      estimated_wait_seconds: estimatedWaitSeconds,
      entered_at: entry.entered_at,
      event_id,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Queue Join]', err.message);
    res.status(500).json({ msg: 'Lỗi khi vào hàng chờ' });
  } finally {
    client.release();
  }
});

// GET /api/queue/status
router.get('/status', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = parseInt(req.query.event_id);

    if (!eventId) {
      return res.status(400).json({ msg: 'Thiếu event_id' });
    }

    const entryRes = await db.query(
      "SELECT * FROM purchase_queue WHERE user_id = $1 AND event_id = $2",
      [userId, eventId]
    );

    if (entryRes.rows.length === 0) {
      return res.status(404).json({ msg: 'Không tìm thấy trong hàng chờ' });
    }
    const entry = entryRes.rows[0];

    // Nếu đã hết hạn
    if (new Date(entry.expires_at) < new Date()) {
      await db.query("DELETE FROM purchase_queue WHERE id = $1", [entry.id]);
      return res.status(410).json({ msg: 'Phiên hàng chờ đã hết hạn', expired: true });
    }

    // 🧪 TEST MODE: chỉ áp dụng cho đúng event
    const testEventId = parseInt(process.env.TEST_QUEUE_EVENT_ID);
    const isTestTarget = testEventId && eventId === testEventId;

    // Tính position hiện tại
    const posRes = await db.query(
      "SELECT COUNT(*) AS cnt FROM purchase_queue WHERE event_id = $1 AND status = 'waiting' AND queue_number < $2",
      [eventId, entry.queue_number]
    );
    let position = parseInt(posRes.rows[0].cnt);

    const totalRes = await db.query(
      "SELECT COUNT(*) AS total FROM purchase_queue WHERE event_id = $1 AND status = 'waiting'",
      [eventId]
    );
    let totalWaiting = parseInt(totalRes.rows[0].total);

    // Giả lập position giảm dần theo thời gian chỉ cho test target
    if (isTestTarget && position === 0) {
      const enteredAt = new Date(entry.entered_at).getTime();
      const elapsedSec = Math.floor((Date.now() - enteredAt) / 1000);
      // Giảm từ 100 → 0 trong 120 giây
      const fakePosition = Math.max(0, 100 - Math.floor(elapsedSec * 100 / 120));
      if (fakePosition > 0) {
        position = fakePosition;
        totalWaiting = fakePosition + 1;
      }
    }

    res.json({
      success: true,
      queue_number: isTestTarget ? entry.queue_number + 100 : entry.queue_number,
      position,
      total_waiting: totalWaiting,
      expires_at: entry.expires_at,
      status: entry.status,
      ticket_data: entry.ticket_data,
    });
  } catch (err) {
    console.error('[Queue Status]', err.message);
    res.status(500).json({ msg: 'Lỗi khi lấy trạng thái hàng chờ' });
  }
});

// DELETE /api/queue/leave
router.delete('/leave', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { event_id } = req.body;

    if (!event_id) {
      return res.status(400).json({ msg: 'Thiếu event_id' });
    }

    await db.query(
      "DELETE FROM purchase_queue WHERE user_id = $1 AND event_id = $2",
      [userId, event_id]
    );

    res.json({ success: true, msg: 'Đã rời hàng chờ' });
  } catch (err) {
    console.error('[Queue Leave]', err.message);
    res.status(500).json({ msg: 'Lỗi khi rời hàng chờ' });
  }
});

module.exports = router;
