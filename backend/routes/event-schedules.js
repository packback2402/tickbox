const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const adminOrOrganizer = require('../middleware/adminOrOrganizer');


// PUT /api/event-schedules/:scheduleId — Cập nhật một ngày diễn
router.put('/:scheduleId', auth, adminOrOrganizer, async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { start_time, end_time, is_active } = req.body;

    const result = await db.query(
      `UPDATE event_schedules 
       SET start_time = COALESCE($1, start_time), 
           end_time = COALESCE($2, end_time),
           is_active = COALESCE($3, is_active)
       WHERE id = $4 RETURNING *`,
      [start_time, end_time, is_active, scheduleId]
    );
    if (result.rows.length === 0) return res.status(404).json({ msg: "Không tìm thấy lịch diễn" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// DELETE /api/event-schedules/:scheduleId — Xóa một ngày diễn
router.delete('/:scheduleId', auth, adminOrOrganizer, async (req, res) => {
  try {
    const { scheduleId } = req.params;
    await db.query("DELETE FROM event_schedules WHERE id = $1", [scheduleId]);
    res.json({ msg: "Đã xóa ngày diễn" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

module.exports = router;
