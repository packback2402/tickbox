const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const adminOrOrganizer = require('../middleware/adminOrOrganizer');


// GET /api/events/search
router.get('/search', async (req, res) => {
  try {
    const { q, category_id, location } = req.query;
    const catIds = req.query.cat
      ? (Array.isArray(req.query.cat) ? req.query.cat : [req.query.cat])
      : [];

    const params = [];
    let paramIndex = 1;

    let query = `
      SELECT
        events.id, events.title, events.description, events.image_url,
        events.event_date, events.end_date, events.organizer,
        events.location, categories.name AS category_name,
        events.organizer_id, events.category_id, events.is_featured, events.status
      FROM events
      JOIN categories ON events.category_id = categories.id
      WHERE events.status = 'published'
    `;

    // Tìm theo tiêu đề (dùng LOWER(unaccent()) để xử lý đúng tiếng Việt hoa/thường)
    if (q && q.trim() !== '') {
      query += ` AND LOWER(unaccent(events.title)) LIKE LOWER(unaccent($${paramIndex}))`;
      params.push(`%${q.trim()}%`);
      paramIndex++;
    }

    // Lọc theo category_id (từ query param cũ)
    if (category_id) {
      query += ` AND events.category_id = $${paramIndex}`;
      params.push(category_id);
      paramIndex++;
    }

    // Lọc theo category IDs (từ filter chips, có thể nhiều)
    if (catIds.length > 0) {
      const placeholders = catIds.map(() => `$${paramIndex++}`).join(', ');
      query += ` AND events.category_id IN (${placeholders})`;
      params.push(...catIds);
    }

    // Lọc theo vị trí (dùng unaccent để khớp không phân biệt dấu)
    if (location && location !== 'all') {
      if (location === 'other') {
        // Vị trí khác = không phải HCM, Hà Nội, Đà Nẵng
        query += ` AND LOWER(unaccent(events.location)) NOT LIKE LOWER(unaccent('%Ho Chi Minh%'))
                   AND LOWER(unaccent(events.location)) NOT LIKE LOWER(unaccent('%Ha Noi%'))
                   AND LOWER(unaccent(events.location)) NOT LIKE LOWER(unaccent('%Da Lat%'))
                   AND LOWER(unaccent(events.location)) NOT LIKE LOWER(unaccent('%Da Nang%'))`;
      } else {
        query += ` AND LOWER(unaccent(events.location)) LIKE LOWER(unaccent($${paramIndex}))`;
        params.push(`%${location}%`);
        paramIndex++;
      }
    }

    query += ` ORDER BY events.event_date DESC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Lỗi tìm kiếm sự kiện:", err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/events/featured
router.get('/featured', async (req, res) => {
  try {
    const featuredEvents = await db.query(
      `SELECT events.*, categories.name AS category_name 
       FROM events
       JOIN categories ON events.category_id = categories.id
       WHERE events.is_featured = TRUE AND events.status = 'published'
       ORDER BY events.event_date DESC 
       LIMIT 6`
    );
    res.status(200).json(featuredEvents.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/events/upcoming
router.get('/upcoming', async (req, res) => {
  try {
    const upcomingEvents = await db.query(
      `SELECT events.*, categories.name AS category_name 
       FROM events
       JOIN categories ON events.category_id = categories.id
       WHERE events.status = 'published'
         AND (
           events.event_date >= NOW()
           OR (events.end_date IS NOT NULL AND events.end_date >= NOW())
         )
       ORDER BY events.event_date ASC
       LIMIT 6`
    );
    res.status(200).json(upcomingEvents.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/events
router.get('/', async (req, res) => {
  try {
    const { category_id } = req.query;

    let query = `
      SELECT 
        events.id, 
        events.title, 
        events.description, 
        events.image_url, 
        events.event_date, 
        events.end_date,  
        events.organizer, 
        events.location, 
        categories.name AS category_name,
        events.organizer_id,
        events.category_id,
        events.is_featured,
        events.status
      FROM events
      JOIN categories ON events.category_id = categories.id
      WHERE events.status = 'published'
    `;

    const params = [];
    if (category_id) {
      query += ` AND events.category_id = $1`;
      params.push(category_id);
    }

    query += ` ORDER BY events.event_date DESC`;

    const allEvents = await db.query(query, params);
    res.status(200).json(allEvents.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// POST /api/events
// Admin: status = 'published', Organizer: status = 'pending'
router.post('/', auth, adminOrOrganizer, async (req, res) => {
  try {
    const {
      title, description, image_url, event_date, end_date, location, category_id, organizer, is_featured,
      bank_account_holder, bank_account_number, bank_name, bank_branch,
      want_invoice, invoice_business_type, invoice_full_name, invoice_company_name, invoice_tax_code, invoice_address,
      license_note, license_files, stage_position,
    } = req.body;
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: "Lỗi xác thực: Không tìm thấy User ID" });
    }
    const organizer_id = req.user.id;
    if (!title || !event_date || !location) {
      return res.status(400).json({ msg: "Thiếu tên, ngày hoặc địa điểm!" });
    }

    // Admin → published ngay, Organizer → pending chờ duyệt
    const eventStatus = req.user.role === 'admin' ? 'published' : 'pending';
    // Chỉ admin mới được set featured
    const featuredValue = req.user.role === 'admin' ? (is_featured || false) : false;

    const newEvent = await db.query(
      `INSERT INTO events (
        title, description, image_url, event_date, end_date, location, category_id, organizer, is_featured, organizer_id, status,
        bank_account_holder, bank_account_number, bank_name, bank_branch,
        want_invoice, invoice_business_type, invoice_full_name, invoice_company_name, invoice_tax_code, invoice_address,
        license_note, license_files, stage_position
       ) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) 
       RETURNING *`,
      [
        title, description, image_url, event_date, end_date, location, category_id, organizer, featuredValue, organizer_id, eventStatus,
        bank_account_holder || null, bank_account_number || null, bank_name || null, bank_branch || null,
        want_invoice || false, invoice_business_type || 'personal', invoice_full_name || null, invoice_company_name || null, invoice_tax_code || null, invoice_address || null,
        license_note || null, (() => {
          if (!license_files) return null;
          if (Array.isArray(license_files)) return license_files;
          try { const p = JSON.parse(license_files); return Array.isArray(p) ? p : null; } catch { return null; }
        })(), stage_position || 'top',
      ]
    );
    if (newEvent.rows.length > 0) {
      const statusMsg = eventStatus === 'pending' 
        ? "Sự kiện đã được tạo và đang chờ Admin duyệt!" 
        : "Tạo sự kiện thành công!";
      res.status(201).json({ ...newEvent.rows[0], msg: statusMsg });
    } else {
      throw new Error("Không thể lưu sự kiện vào database");
    }
  } catch (err) {
    console.error("LỖI TẠO SỰ KIỆN:", err);
    res.status(500).send("Lỗi Server: " + err.message);
  }
});

// GET /api/events/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const event = await db.query(`
      SELECT 
        events.id, 
        events.title, 
        events.description, 
        events.image_url, 
        events.event_date,
        events.end_date,
        events.organizer,
        events.location, 
        categories.name AS category_name,
        events.organizer_id,
        events.category_id,
        events.status,
        events.has_seatmap,
        events.seatmap_type,
        events.bank_account_holder,
        events.bank_account_number,
        events.bank_name,
        events.bank_branch,
        events.want_invoice,
        events.invoice_business_type,
        events.invoice_full_name,
        events.invoice_company_name,
        events.invoice_tax_code,
        events.invoice_address,
        events.license_note,
        events.license_files
      FROM events
      JOIN categories ON events.category_id = categories.id
      WHERE events.id = $1
    `, [id]);
    if (event.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy sự kiện" });
    }
    const row = event.rows[0];
    // Parse license_files from JSON string to array
    if (row.license_files && typeof row.license_files === 'string') {
      try { row.license_files = JSON.parse(row.license_files); } catch { row.license_files = []; }
    }
    res.status(200).json(row);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// PUT /api/events/:id — Admin sửa tất cả, Organizer chỉ sửa event của mình
router.put('/:id', auth, adminOrOrganizer, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, image_url, event_date, end_date, location, category_id, organizer, is_featured,
      bank_account_holder, bank_account_number, bank_name, bank_branch,
      want_invoice, invoice_business_type, invoice_full_name, invoice_company_name, invoice_tax_code, invoice_address,
      license_note, license_files, stage_position,
    } = req.body;
    if (!title || !event_date || !location) {
      return res.status(400).json({ msg: "Thiếu thông tin bắt buộc (Tên, Ngày, Địa điểm)!" });
    }

    // Kiểm tra ownership cho organizer
    if (req.user.role === 'organizer') {
      const eventCheck = await db.query("SELECT organizer_id FROM events WHERE id = $1", [id]);
      if (eventCheck.rows.length === 0) {
        return res.status(404).json({ msg: "Không tìm thấy sự kiện" });
      }
      if (eventCheck.rows[0].organizer_id !== req.user.id) {
        return res.status(403).json({ msg: "Bạn không có quyền sửa sự kiện này!" });
      }
    }

    // Chỉ admin mới được set featured
    const featuredValue = req.user.role === 'admin' ? (is_featured || false) : false;

    // Nếu organizer sửa event đã bị reject → chuyển lại pending
    let statusUpdate = '';
    if (req.user.role === 'organizer') {
      statusUpdate = ", status = 'pending'";
    }

    const updatedEvent = await db.query(
      `UPDATE events 
       SET title = $1, 
           description = $2, 
           image_url = $3, 
           event_date = $4, 
           end_date = $5, 
           location = $6, 
           category_id = $7, 
           organizer = $8, 
           is_featured = $9,
           bank_account_holder = $10,
           bank_account_number = $11,
           bank_name = $12,
           bank_branch = $13,
           want_invoice = $14,
           invoice_business_type = $15,
           invoice_full_name = $16,
           invoice_company_name = $17,
           invoice_tax_code = $18,
           invoice_address = $19,
           license_note = $20,
           license_files = $21,
           stage_position = $22
           ${statusUpdate}
       WHERE id = $23 
       RETURNING *`,
      [
        title, description, image_url, event_date, end_date, location, category_id, organizer, featuredValue,
        bank_account_holder || null, bank_account_number || null, bank_name || null, bank_branch || null,
        want_invoice || false, invoice_business_type || 'personal', invoice_full_name || null, invoice_company_name || null, invoice_tax_code || null, invoice_address || null,
        license_note || null, (() => {
          // Safe parse: license_files có thể là JSON string hoặc array
          if (!license_files) return null;
          if (Array.isArray(license_files)) return license_files;
          try { const p = JSON.parse(license_files); return Array.isArray(p) ? p : null; } catch { return null; }
        })(), stage_position || 'top',
        id,
      ]
    );

    if (updatedEvent.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy sự kiện cần sửa" });
    }

    res.status(200).json(updatedEvent.rows[0]);
  } catch (err) {
    console.error("LỖI SỬA SỰ KIỆN:", err.message);
    res.status(500).send("Lỗi Server: " + err.message);
  }
});

// PATCH /api/events/:id/stage-position — chỉ cập nhật vị trí sân khấu
router.patch('/:id/stage-position', auth, adminOrOrganizer, async (req, res) => {
  try {
    const { id } = req.params;
    const { stage_position } = req.body;
    if (!stage_position) return res.status(400).json({ msg: 'Thiếu stage_position' });

    const result = await db.query(
      `UPDATE events SET stage_position = $1 WHERE id = $2 RETURNING id, stage_position`,
      [stage_position, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ msg: 'Không tìm thấy sự kiện' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Lỗi Server');
  }
});

// DELETE /api/events/:id — Admin xóa tất cả, Organizer chỉ xóa event của mình
router.delete('/:id', auth, adminOrOrganizer, async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra ownership cho organizer
    if (req.user.role === 'organizer') {
      const eventCheck = await db.query("SELECT organizer_id FROM events WHERE id = $1", [id]);
      if (eventCheck.rows.length === 0) {
        return res.status(404).json({ msg: "Không tìm thấy sự kiện" });
      }
      if (eventCheck.rows[0].organizer_id !== req.user.id) {
        return res.status(403).json({ msg: "Bạn không có quyền xóa sự kiện này!" });
      }
    }

    await db.query("DELETE FROM tickets WHERE event_id = $1", [id]);
    const deleteOp = await db.query(
      "DELETE FROM events WHERE id = $1 RETURNING *",
      [id]
    );

    if (deleteOp.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy sự kiện" });
    }
    res.status(200).json({ msg: "Sự kiện đã được xóa" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/events/:id/schedules
router.get('/:id/schedules', async (req, res) => {
  try {
    const { id } = req.params;
    const schedulesRes = await db.query(
      `SELECT * FROM event_schedules 
       WHERE event_id = $1 AND is_active = TRUE
       ORDER BY schedule_date ASC`,
      [id]
    );
    
    const scheduleIds = schedulesRes.rows.map(s => s.id);
    let ticketAllocations = [];
    if (scheduleIds.length > 0) {
      const stRes = await db.query(
        `SELECT st.*, t.type AS ticket_type, t.price AS ticket_price
         FROM schedule_tickets st
         JOIN tickets t ON t.id = st.ticket_id
         WHERE st.schedule_id = ANY($1)
         ORDER BY st.schedule_id, t.price ASC`,
        [scheduleIds]
      );
      ticketAllocations = stRes.rows;
    }

    const schedules = schedulesRes.rows.map(s => ({
      ...s,
      tickets: ticketAllocations
        .filter(ta => ta.schedule_id === s.id)
        .map(ta => ({
          ticket_id: ta.ticket_id,
          ticket_type: ta.ticket_type,
          ticket_price: ta.ticket_price,
          daily_quantity: ta.daily_quantity,
          daily_sold: ta.daily_sold,
          daily_available: ta.daily_quantity - ta.daily_sold,
        }))
    }));

    res.json(schedules);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// POST /api/events/:id/schedules/generate — Tạo lịch diễn + tự động phân bổ vé
router.post('/:id/schedules/generate', auth, adminOrOrganizer, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_time, end_time } = req.body;

    const eventRes = await db.query("SELECT event_date, end_date, organizer_id FROM events WHERE id = $1", [id]);
    if (eventRes.rows.length === 0) return res.status(404).json({ msg: "Không tìm thấy sự kiện" });

    const event = eventRes.rows[0];

    if (req.user.role === 'organizer' && event.organizer_id !== req.user.id) {
      return res.status(403).json({ msg: "Bạn không có quyền!" });
    }

    if (!event.end_date) {
      return res.status(400).json({ msg: "Sự kiện cần có ngày kết thúc để tạo lịch diễn nhiều ngày!" });
    }

    const startDate = new Date(event.event_date);
    const endDate = new Date(event.end_date);
    const sTime = start_time || '09:00';
    const eTime = end_time || '19:30';

    const ticketsRes = await db.query("SELECT id, type, quantity_available FROM tickets WHERE event_id = $1", [id]);
    const tickets = ticketsRes.rows;

    await db.query("DELETE FROM event_schedules WHERE event_id = $1", [id]);

    const schedules = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    const lastDate = new Date(endDate);
    lastDate.setHours(0, 0, 0, 0);

    while (currentDate <= lastDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const result = await db.query(
        `INSERT INTO event_schedules (event_id, schedule_date, start_time, end_time, is_active) 
         VALUES ($1, $2, $3, $4, TRUE) 
         ON CONFLICT (event_id, schedule_date) DO UPDATE SET start_time = $3, end_time = $4, is_active = TRUE
         RETURNING *`,
        [id, dateStr, sTime, eTime]
      );
      schedules.push(result.rows[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const totalDays = schedules.length;

    // Phân bổ vé đều cho mỗi ngày
    for (const ticket of tickets) {
      const perDay = Math.floor(ticket.quantity_available / totalDays);
      const remainder = ticket.quantity_available % totalDays;

      for (let i = 0; i < schedules.length; i++) {
        const dailyQty = perDay + (i < remainder ? 1 : 0);
        await db.query(
          `INSERT INTO schedule_tickets (schedule_id, ticket_id, daily_quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (schedule_id, ticket_id) DO UPDATE SET daily_quantity = $3`,
          [schedules[i].id, ticket.id, dailyQty]
        );
      }
    }

    res.status(201).json({ 
      msg: `Đã tạo ${totalDays} ngày diễn và phân bổ ${tickets.length} loại vé!`, 
      schedules,
      ticket_count: tickets.length,
    });
  } catch (err) {
    console.error("Lỗi tạo lịch diễn:", err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/events/:id/schedule-tickets
router.get('/:id/schedule-tickets', auth, adminOrOrganizer, async (req, res) => {
  try {
    const { id } = req.params;

    const schedulesRes = await db.query(
      `SELECT id, schedule_date, start_time, end_time 
       FROM event_schedules WHERE event_id = $1
       ORDER BY schedule_date ASC`,
      [id]
    );

    const ticketsRes = await db.query(
      // Tính quantity_sold từ order_items (số vé đã bán thành công)
      `SELECT t.id, t.type, t.price, t.quantity_available,
              COALESCE(SUM(oi.quantity), 0)::int AS quantity_sold
       FROM tickets t
       LEFT JOIN order_items oi ON oi.ticket_id = t.id
       LEFT JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
       WHERE t.event_id = $1
       GROUP BY t.id
       ORDER BY t.price ASC`,
      [id]
    );

    // quantity_total = số vé gốc = còn lại + đã bán
    const tickets = ticketsRes.rows.map(t => ({
      ...t,
      quantity_sold: parseInt(t.quantity_sold) || 0,
      quantity_total: (parseInt(t.quantity_available) || 0) + (parseInt(t.quantity_sold) || 0),
    }));

    const allocRes = await db.query(
      `SELECT st.schedule_id, st.ticket_id, st.daily_quantity, st.daily_sold
       FROM schedule_tickets st
       JOIN event_schedules es ON es.id = st.schedule_id
       WHERE es.event_id = $1
       ORDER BY es.schedule_date, st.ticket_id`,
      [id]
    );

    res.json({
      schedules: schedulesRes.rows,
      tickets,
      allocations: allocRes.rows,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// PUT /api/events/:id/schedule-tickets — Cập nhật phân bổ vé theo ngày (batch update)
router.put('/:id/schedule-tickets', auth, adminOrOrganizer, async (req, res) => {
  try {
    const { id } = req.params;
    const { allocations } = req.body;

    if (!Array.isArray(allocations)) {
      return res.status(400).json({ msg: "Dữ liệu không hợp lệ!" });
    }

    const eventRes = await db.query("SELECT organizer_id FROM events WHERE id = $1", [id]);
    if (eventRes.rows.length === 0) return res.status(404).json({ msg: "Không tìm thấy sự kiện" });
    if (req.user.role === 'organizer' && eventRes.rows[0].organizer_id !== req.user.id) {
      return res.status(403).json({ msg: "Bạn không có quyền!" });
    }

    const ticketsRes = await db.query(
      // Tính quantity_sold từ order_items để xác định tổng vé gốc
      `SELECT t.id, t.type, t.quantity_available,
              COALESCE(SUM(oi.quantity), 0)::int AS quantity_sold
       FROM tickets t
       LEFT JOIN order_items oi ON oi.ticket_id = t.id
       LEFT JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
       WHERE t.event_id = $1
       GROUP BY t.id`,
      [id]
    );
    const ticketsMap = {};
    ticketsRes.rows.forEach(t => {
      const sold = parseInt(t.quantity_sold) || 0;
      ticketsMap[t.id] = {
        ...t,
        quantity_total: (parseInt(t.quantity_available) || 0) + sold,
      };
    });

    // Validate: tổng daily_quantity phải = quantity_total (số vé gốc, bao gồm đã bán)
    const totalsByTicket = {};
    allocations.forEach(a => {
      if (!totalsByTicket[a.ticket_id]) totalsByTicket[a.ticket_id] = 0;
      totalsByTicket[a.ticket_id] += parseInt(a.daily_quantity) || 0;
    });

    const errors = [];
    for (const [ticketId, total] of Object.entries(totalsByTicket)) {
      const ticket = ticketsMap[ticketId];
      if (ticket && total !== ticket.quantity_total) {
        errors.push(
          `"${ticket.type}": tổng phân bổ = ${total}, cần = ${ticket.quantity_total}`
        );
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        msg: "Tổng phân bổ không khớp với số lượng vé!",
        errors 
      });
    }

    for (const a of allocations) {
      await db.query(
        `INSERT INTO schedule_tickets (schedule_id, ticket_id, daily_quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (schedule_id, ticket_id) 
         DO UPDATE SET daily_quantity = $3`,
        [a.schedule_id, a.ticket_id, parseInt(a.daily_quantity) || 0]
      );
    }

    res.json({ msg: "Đã cập nhật phân bổ vé thành công!" });
  } catch (err) {
    console.error("Lỗi cập nhật phân bổ vé:", err.message);
    res.status(500).send("Lỗi Server");
  }
});


// POST /api/events/:id/schedules — Thêm một ngày diễn cụ thể
router.post('/:id/schedules', auth, adminOrOrganizer, async (req, res) => {
  try {
    const { id } = req.params;
    const { schedule_date, start_time, end_time } = req.body;

    if (!schedule_date) return res.status(400).json({ msg: "Thiếu ngày diễn!" });

    const result = await db.query(
      `INSERT INTO event_schedules (event_id, schedule_date, start_time, end_time)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, schedule_date, start_time || '09:00', end_time || '17:00']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ msg: "Ngày này đã có trong lịch diễn!" });
    }
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// DELETE /api/events/:id/schedules — Xóa tất cả lịch diễn của sự kiện
router.delete('/:id/schedules', auth, adminOrOrganizer, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM event_schedules WHERE event_id = $1", [id]);
    res.json({ msg: "Đã xóa tất cả lịch diễn" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

module.exports = router;
