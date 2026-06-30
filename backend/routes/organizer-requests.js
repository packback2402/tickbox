const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// POST /api/organizer-requests — Customer gửi yêu cầu trở thành Organizer
router.post('/', auth, async (req, res) => {
  try {
    // Chỉ customer mới được gửi yêu cầu
    if (req.user.role !== 'customer') {
      return res.status(400).json({ msg: "Chỉ tài khoản khách hàng mới có thể đăng ký làm đối tác!" });
    }

    const { org_name, phone, email, message } = req.body;

    if (!org_name || !org_name.trim()) {
      return res.status(400).json({ msg: "Vui lòng nhập tên tổ chức!" });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ msg: "Vui lòng nhập số điện thoại!" });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ msg: "Vui lòng nhập email liên hệ!" });
    }

    // Kiểm tra đã gửi yêu cầu pending chưa
    const existing = await db.query(
      "SELECT * FROM organizer_requests WHERE user_id = $1 AND status = 'pending'",
      [req.user.id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ msg: "Bạn đã có một yêu cầu đang chờ duyệt!" });
    }

    // Nếu đã bị từ chối trước đó → xóa request cũ để cho phép gửi lại
    await db.query(
      "DELETE FROM organizer_requests WHERE user_id = $1 AND status = 'rejected'",
      [req.user.id]
    );

    const result = await db.query(
      "INSERT INTO organizer_requests (user_id, org_name, phone, email, message) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [req.user.id, org_name.trim(), phone.trim(), email.trim(), message ? message.trim() : null]
    );

    res.status(201).json({ msg: "Yêu cầu đã được gửi! Vui lòng chờ Admin xét duyệt.", request: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/organizer-requests/my-status — Kiểm tra trạng thái yêu cầu của user hiện tại
router.get('/my-status', auth, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM organizer_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.json({ status: 'none' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

module.exports = router;
