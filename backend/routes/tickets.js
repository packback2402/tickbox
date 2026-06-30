const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const adminOrOrganizer = require('../middleware/adminOrOrganizer');

// GET /api/tickets/:event_id
router.get('/:event_id', async (req, res) => {
  try {
    const { event_id } = req.params;
    const tickets = await db.query(
      "SELECT * FROM tickets WHERE event_id = $1 ORDER BY price ASC",
      [event_id]
    );
    res.status(200).json(tickets.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// POST /api/tickets — Tạo vé (Admin hoặc Organizer, chỉ cho event của mình)
router.post('/', auth, adminOrOrganizer, async (req, res) => {
  try {
    const { event_id, type, price, quantity_available } = req.body;

    // Kiểm tra ownership cho organizer
    if (req.user.role === 'organizer') {
      const eventCheck = await db.query("SELECT organizer_id FROM events WHERE id = $1", [event_id]);
      if (eventCheck.rows.length === 0) {
        return res.status(404).json({ msg: "Sự kiện không tồn tại!" });
      }
      if (eventCheck.rows[0].organizer_id !== req.user.id) {
        return res.status(403).json({ msg: "Bạn không có quyền thêm vé cho sự kiện này!" });
      }
    }

    const newTicket = await db.query(
      "INSERT INTO tickets (event_id, type, price, quantity_available) VALUES ($1, $2, $3, $4) RETURNING *",
      [event_id, type, price, quantity_available]
    );

    res.status(201).json(newTicket.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// PUT /api/tickets/:id — Cập nhật vé
router.put('/:id', auth, adminOrOrganizer, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, price, quantity_available } = req.body;

    const ticketCheck = await db.query("SELECT event_id FROM tickets WHERE id = $1", [id]);
    if (ticketCheck.rows.length === 0) return res.status(404).json({ msg: "Vé không tồn tại" });
    const event_id = ticketCheck.rows[0].event_id;

    if (req.user.role === 'organizer') {
      const eventCheck = await db.query("SELECT organizer_id FROM events WHERE id = $1", [event_id]);
      if (eventCheck.rows.length === 0 || eventCheck.rows[0].organizer_id !== req.user.id) {
        return res.status(403).json({ msg: "Bạn không có quyền sửa vé này!" });
      }
    }

    const updated = await db.query(
      "UPDATE tickets SET type = $1, price = $2, quantity_available = $3 WHERE id = $4 RETURNING *",
      [type, price, quantity_available, id]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// DELETE /api/tickets/:id — Xóa vé
router.delete('/:id', auth, adminOrOrganizer, async (req, res) => {
  try {
    const { id } = req.params;

    const ticketCheck = await db.query("SELECT event_id FROM tickets WHERE id = $1", [id]);
    if (ticketCheck.rows.length === 0) return res.status(404).json({ msg: "Vé không tồn tại" });
    const event_id = ticketCheck.rows[0].event_id;

    if (req.user.role === 'organizer') {
      const eventCheck = await db.query("SELECT organizer_id FROM events WHERE id = $1", [event_id]);
      if (eventCheck.rows.length === 0 || eventCheck.rows[0].organizer_id !== req.user.id) {
        return res.status(403).json({ msg: "Bạn không có quyền xoá vé này!" });
      }
    }

    // Kiểm tra đã có người mua chưa
    const orderCheck = await db.query("SELECT 1 FROM order_items WHERE ticket_id = $1 LIMIT 1", [id]);
    if (orderCheck.rows.length > 0) {
      return res.status(400).json({ msg: "Vé này đã có người mua, không thể xoá!" });
    }

    await db.query("DELETE FROM tickets WHERE id = $1", [id]);
    res.json({ msg: "Đã xóa vé" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

module.exports = router;
