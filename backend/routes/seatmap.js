const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');
const adminOrOrganizer = require('../middleware/adminOrOrganizer');
const { PLATFORM_FEE_RATE, ORGANIZER_SHARE } = require('../config');

// GET /api/events/:id/seatmap
router.get('/events/:id/seatmap', async (req, res) => {
  try {
    const { id } = req.params;

    const eventRes = await db.query(
      "SELECT id, title, has_seatmap, seatmap_type, svg_layout, event_date, end_date, location FROM events WHERE id = $1",
      [id]
    );
    if (eventRes.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy sự kiện" });
    }

    const event = eventRes.rows[0];
    if (!event.has_seatmap) {
      return res.status(400).json({ msg: "Sự kiện này không có sơ đồ chỗ ngồi" });
    }

    const eventInfo = {
      id: event.id,
      title: event.title,
      svg_layout: event.svg_layout,
      event_date: event.event_date,
      end_date: event.end_date,
      location: event.location,
    };

    if (event.seatmap_type === 'zone') {
      const zones = await db.query(
        "SELECT *, COALESCE(zone_type, 'standing') as zone_type FROM venue_zones WHERE event_id = $1 ORDER BY sort_order ASC",
        [id]
      );
      return res.json({
        type: 'zone',
        event: eventInfo,
        zones: zones.rows
      });
    } else if (event.seatmap_type === 'mixed') {
      // Cleanup expired holds
      await db.query(`
        UPDATE seats SET status = 'available'
        WHERE id IN (SELECT seat_id FROM seat_holds WHERE expires_at < NOW())
        AND status = 'held'
      `);
      await db.query("DELETE FROM seat_holds WHERE expires_at < NOW()");
      await db.query(`
        UPDATE seats SET status = 'available'
        WHERE event_id = $1 AND status = 'held'
        AND id NOT IN (SELECT seat_id FROM seat_holds WHERE expires_at > NOW())
      `, [id]);

      const zonesRes = await db.query(
        "SELECT *, COALESCE(zone_type, 'standing') as zone_type FROM venue_zones WHERE event_id = $1 ORDER BY sort_order ASC",
        [id]
      );

      const enrichedZones = await Promise.all(zonesRes.rows.map(async (zone) => {
        if (zone.zone_type === 'seated' || zone.zone_type === 'best_available') {
          const countRes = await db.query(
            "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'available') as available FROM seats WHERE event_id = $1 AND section = $2",
            [id, zone.name]
          );
          return {
            ...zone,
            seat_total: parseInt(countRes.rows[0].total),
            seat_available: parseInt(countRes.rows[0].available),
          };
        }
        return zone;
      }));

      return res.json({
        type: 'mixed',
        event: eventInfo,
        zones: enrichedZones
      });

    } else if (event.seatmap_type === 'seat') {
      // Cleanup expired holds
      await db.query(`
        UPDATE seats SET status = 'available'
        WHERE id IN (
          SELECT seat_id FROM seat_holds WHERE expires_at < NOW()
        ) AND status = 'held'
      `);
      await db.query("DELETE FROM seat_holds WHERE expires_at < NOW()");
      await db.query(`
        UPDATE seats SET status = 'available'
        WHERE event_id = $1 AND status = 'held'
        AND id NOT IN (SELECT seat_id FROM seat_holds WHERE expires_at > NOW())
      `, [id]);
      await db.query(`
        UPDATE seats SET status = 'available'
        WHERE event_id = $1 AND status = 'sold'
        AND id NOT IN (
          SELECT oi.seat_id FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE oi.seat_id IS NOT NULL AND o.status = 'completed'
        )
      `, [id]);

      const seats = await db.query(
        "SELECT id, section, row_label, seat_number, status, price FROM seats WHERE event_id = $1 ORDER BY section, row_label, seat_number",
        [id]
      );

      // Nếu user đã login → đánh dấu ghế user đang hold
      let userHeldSeatIds = [];
      const authHeader = req.headers.authorization;
      if (authHeader) {
        try {
          const token = authHeader.replace('Bearer ', '');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const holds = await db.query(
            "SELECT seat_id FROM seat_holds WHERE user_id = $1 AND expires_at > NOW()",
            [decoded.id]
          );
          userHeldSeatIds = holds.rows.map(h => h.seat_id);
        } catch (e) { /* token invalid */ }
      }

      const zoneColors = {};
      try {
        const zonesRes = await db.query("SELECT name, color FROM venue_zones WHERE event_id = $1", [id]);
        zonesRes.rows.forEach(z => { zoneColors[z.name] = z.color; });
      } catch (e) { /* no zones */ }
      const defaultColors = ['#E74C3C', '#E67E22', '#2ECC71', '#3498DB', '#9B59B6', '#1ABC9C', '#F39C12', '#E91E63'];

      const seatSections = {};
      let sectionIdx = 0;
      seats.rows.forEach(seat => {
        if (!seatSections[seat.section]) {
          seatSections[seat.section] = {
            name: seat.section, price: seat.price,
            color: zoneColors[seat.section] || defaultColors[sectionIdx % defaultColors.length],
            rows: {}
          };
          sectionIdx++;
        }
        if (!seatSections[seat.section].rows[seat.row_label]) {
          seatSections[seat.section].rows[seat.row_label] = [];
        }
        seatSections[seat.section].rows[seat.row_label].push({
          id: seat.id,
          number: seat.seat_number,
          status: userHeldSeatIds.includes(seat.id) ? 'mine' : seat.status,
          price: seat.price
        });
      });

      return res.json({
        type: 'seat',
        event: eventInfo,
        sections: Object.values(seatSections),
        userHeldSeatIds
      });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// DELETE /api/events/:id/seatmap
router.delete('/events/:id/seatmap', auth, adminOrOrganizer, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const eventRes = await client.query("SELECT * FROM events WHERE id = $1", [id]);
    if (eventRes.rows.length === 0) return res.status(404).json({ msg: "Không tìm thấy sự kiện" });
    const event = eventRes.rows[0];
    if (req.user.role === 'organizer' && event.organizer_id !== req.user.id) {
      return res.status(403).json({ msg: "Bạn không có quyền!" });
    }

    await client.query('BEGIN');
    await client.query("UPDATE events SET has_seatmap = FALSE, seatmap_type = NULL, svg_layout = NULL WHERE id = $1", [id]);
    await client.query("DELETE FROM seat_holds WHERE seat_id IN (SELECT id FROM seats WHERE event_id = $1)", [id]);
    await client.query("DELETE FROM seats WHERE event_id = $1", [id]);
    await client.query("DELETE FROM venue_zones WHERE event_id = $1", [id]);
    await client.query('COMMIT');
    
    res.json({ msg: "Đã xoá sơ đồ thành công" });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).send("Lỗi Server");
  } finally {
    client.release();
  }
});

// POST /api/events/:id/generate-seatmap
router.post('/events/:id/generate-seatmap', auth, adminOrOrganizer, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { type, zones, sections, svg_layout } = req.body;

    const eventRes = await client.query("SELECT * FROM events WHERE id = $1", [id]);
    if (eventRes.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy sự kiện" });
    }

    const event = eventRes.rows[0];
    if (req.user.role === 'organizer' && event.organizer_id !== req.user.id) {
      return res.status(403).json({ msg: "Bạn không có quyền!" });
    }

    await client.query('BEGIN');

    await client.query("DELETE FROM seat_holds WHERE seat_id IN (SELECT id FROM seats WHERE event_id = $1)", [id]);
    await client.query("DELETE FROM seats WHERE event_id = $1", [id]);
    await client.query("DELETE FROM venue_zones WHERE event_id = $1", [id]);

    if (type === 'zone') {
      if (!zones || zones.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ msg: "Cần ít nhất 1 khu vực!" });
      }

      const nameCounts = {};
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        const baseName = (z.name || '').trim();
        nameCounts[baseName] = (nameCounts[baseName] || 0) + 1;
        
        let uniqueName = baseName;
        if (nameCounts[baseName] > 1) {
          uniqueName = `${baseName} (${nameCounts[baseName]})`;
        }

        await client.query(
          "INSERT INTO venue_zones (event_id, name, color, price, capacity, sort_order, svg_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [id, uniqueName, z.color || '#4A90D9', z.price, z.capacity, i, z.svg_id || null]
        );
      }

      await client.query(
        "UPDATE events SET has_seatmap = TRUE, seatmap_type = 'zone', svg_layout = $1 WHERE id = $2",
        [svg_layout || null, id]
      );

      await client.query('COMMIT');
      res.json({ msg: `Đã tạo ${zones.length} khu vực cho sự kiện`, type: 'zone' });

    } else if (type === 'seat') {
      if (req.body.grid && Array.isArray(req.body.grid)) {
        const grid = req.body.grid;
        const activeSeats = grid.filter(g => !g.disabled && g.tier && g.price != null);

        if (activeSeats.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ msg: "Lưới trống! Hãy tô màu ít nhất 1 ghế." });
        }

        for (const cell of activeSeats) {
          await client.query(
            "INSERT INTO seats (event_id, section, row_label, seat_number, price) VALUES ($1, $2, $3, $4, $5)",
            [id, cell.tier, cell.row, cell.col, cell.price]
          );
        }

        const DEFAULT_SECTION_COLORS = ['#E74C3C', '#E67E22', '#2ECC71', '#3498DB', '#9B59B6', '#1ABC9C'];
        const sectionMap = {};
        let sortOrder = 0;
        for (const cell of activeSeats) {
          if (!sectionMap[cell.tier]) {
            sectionMap[cell.tier] = { name: cell.tier, price: cell.price, color: cell.color || DEFAULT_SECTION_COLORS[sortOrder % DEFAULT_SECTION_COLORS.length], sort: sortOrder++ };
          }
        }
        for (const sec of Object.values(sectionMap)) {
          await client.query(
            "INSERT INTO venue_zones (event_id, name, color, price, capacity, sort_order, zone_type) VALUES ($1, $2, $3, $4, $5, $6, 'seated')",
            [id, sec.name, sec.color, sec.price, 0, sec.sort]
          );
        }

        await client.query(
          "UPDATE events SET has_seatmap = TRUE, seatmap_type = 'seat', svg_layout = NULL WHERE id = $1",
          [id]
        );

        await client.query('COMMIT');
        return res.json({
          msg: `Đã tạo ${activeSeats.length} ghế cho sự kiện`,
          type: 'seat', total: activeSeats.length
        });
      }

      if (!sections || sections.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ msg: "Cần ít nhất 1 khu vực ghế!" });
      }

      let totalSeats = 0;
      const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let startRowIdx = 0;

      for (const section of sections) {
        for (let r = 0; r < section.rows; r++) {
          const rowLabel = rowLabels[startRowIdx + r] || `R${startRowIdx + r + 1}`;
          for (let s = 1; s <= section.seats_per_row; s++) {
            await client.query(
              "INSERT INTO seats (event_id, section, row_label, seat_number, price) VALUES ($1, $2, $3, $4, $5)",
              [id, section.name, rowLabel, s, section.price]
            );
            totalSeats++;
          }
        }
        startRowIdx += section.rows;
      }

      await client.query(
        "UPDATE events SET has_seatmap = TRUE, seatmap_type = 'seat', svg_layout = $1 WHERE id = $2",
        [svg_layout || null, id]
      );

      await client.query('COMMIT');
      res.json({ msg: `Đã tạo ${totalSeats} ghế cho sự kiện`, type: 'seat', total: totalSeats });

    } else if (type === 'mixed') {
      if (!zones || zones.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ msg: "Cần ít nhất 1 khu vực!" });
      }

      let totalSeats = 0;
      const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

      // Group zones by name to avoid venue_zones_event_id_name_key violation
      const mergedZonesMap = {};
      for (const z of zones) {
        const zName = (z.name || '').trim();
        if (!mergedZonesMap[zName]) {
          mergedZonesMap[zName] = { ...z, svg_ids: [z.svg_id], originalBlocks: [z] };
        } else {
          if (z.svg_id) mergedZonesMap[zName].svg_ids.push(z.svg_id);
          mergedZonesMap[zName].originalBlocks.push(z);
          mergedZonesMap[zName].capacity = (mergedZonesMap[zName].capacity || 0) + (z.capacity || 0);
        }
      }

      const mergedZones = Object.values(mergedZonesMap);

      for (let i = 0; i < mergedZones.length; i++) {
        const mz = mergedZones[i];
        const zoneType = mz.zone_type || 'standing';
        const zoneName = (mz.name || '').trim();
        const svgIdsJoined = mz.svg_ids.filter(Boolean).join(',');

        let seatCapacity = 0;
        if (zoneType === 'seated' || zoneType === 'best_available') {
          seatCapacity = mz.originalBlocks.reduce((acc, b) => {
            if (b.total_seats && b.total_seats > 0) return acc + parseInt(b.total_seats);
            return acc + (b.rows || 0) * (b.cols || 0);
          }, 0);
        } else {
          seatCapacity = mz.capacity || 0;
        }

        await client.query(
          "INSERT INTO venue_zones (event_id, name, color, price, capacity, sort_order, svg_id, zone_type, grid_rows, grid_cols) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
          [
            id, zoneName,
            mz.color || '#4A90D9',
            mz.price,
            seatCapacity,
            i,
            svgIdsJoined || null,
            zoneType,
            mz.originalBlocks[0]?.rows || 0,
            mz.originalBlocks[0]?.cols || 0
          ]
        );

        // Zone ngồi: tự động gen seats
        if (zoneType === 'seated' || zoneType === 'best_available') {
          let rowOffset = 0;
          for (const block of mz.originalBlocks) {
            const hasTotalSeats = block.total_seats && block.total_seats > 0;
            const rows = block.rows || 0;
            const cols = block.cols || 0;

            if (hasTotalSeats) {
              const total = parseInt(block.total_seats);
              const autoRows = rows > 0 ? rows : Math.ceil(Math.sqrt(total));
              const autoCols = cols > 0 ? cols : Math.ceil(total / autoRows);
              let remaining = total;

              for (let r = 0; r < autoRows && remaining > 0; r++) {
                const rowIdx = rowOffset + r;
                const rowLabel = rowLabels[rowIdx] || `R${rowIdx + 1}`;
                const seatsInThisRow = Math.min(autoCols, remaining);
                for (let s = 1; s <= seatsInThisRow; s++) {
                  await client.query(
                    "INSERT INTO seats (event_id, section, row_label, seat_number, price) VALUES ($1, $2, $3, $4, $5)",
                    [id, zoneName, rowLabel, s, mz.price]
                  );
                  totalSeats++;
                  remaining--;
                }
              }
              rowOffset += autoRows;
            } else if (rows > 0 && cols > 0) {
              for (let r = 0; r < rows; r++) {
                const rowIdx = rowOffset + r;
                const rowLabel = rowLabels[rowIdx] || `R${rowIdx + 1}`;
                for (let s = 1; s <= cols; s++) {
                  await client.query(
                    "INSERT INTO seats (event_id, section, row_label, seat_number, price) VALUES ($1, $2, $3, $4, $5)",
                    [id, zoneName, rowLabel, s, mz.price]
                  );
                  totalSeats++;
                }
              }
              rowOffset += rows;
            }
          }
        }
      }

      await client.query(
        "UPDATE events SET has_seatmap = TRUE, seatmap_type = 'mixed', svg_layout = $1 WHERE id = $2",
        [svg_layout || null, id]
      );

      await client.query('COMMIT');
      const standCount = zones.filter(z => (z.zone_type || 'standing') === 'standing').length;
      const seatCount = zones.filter(z => z.zone_type === 'seated').length;
      res.json({
        msg: `Đã tạo ${standCount} khu đứng + ${seatCount} khu ngồi (${totalSeats} ghế) cho sự kiện`,
        type: 'mixed',
        standing_zones: standCount,
        seated_zones: seatCount,
        total_seats: totalSeats
      });

    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: "Type phải là 'zone', 'seat' hoặc 'mixed'" });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  } finally {
    client.release();
  }
});

// POST /api/events/:id/best-available
router.post('/events/:id/best-available', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const eventId = parseInt(req.params.id);
    const { zone_name, quantity } = req.body;
    const qty = parseInt(quantity);

    if (!zone_name || !qty || qty < 1 || qty > 10) {
      return res.status(400).json({ msg: 'Số lượng phải từ 1-10 và cần tên zone' });
    }

    await client.query('BEGIN');

    const zoneRes = await client.query(
      `SELECT * FROM venue_zones WHERE event_id = $1 AND name = $2`,
      [eventId, zone_name]
    );
    if (zoneRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Không tìm thấy zone' });
    }
    const zone = zoneRes.rows[0];

    // Giải phóng holds cũ của user
    const oldHolds = await client.query(
      "SELECT seat_id FROM seat_holds WHERE user_id = $1",
      [req.user.id]
    );
    if (oldHolds.rows.length > 0) {
      const oldIds = oldHolds.rows.map(h => h.seat_id);
      await client.query(
        `UPDATE seats SET status = 'available' WHERE id = ANY($1) AND status = 'held'`,
        [oldIds]
      );
      await client.query("DELETE FROM seat_holds WHERE user_id = $1", [req.user.id]);
    }

    // Cleanup expired holds
    await client.query(`
      UPDATE seats SET status = 'available'
      WHERE id IN (SELECT seat_id FROM seat_holds WHERE expires_at < NOW())
      AND status = 'held'
    `);
    await client.query("DELETE FROM seat_holds WHERE expires_at < NOW()");

    // Lấy ghế available với FOR UPDATE SKIP LOCKED
    const seatsRes = await client.query(
      `SELECT s.id, s.row_label, s.seat_number, s.price, s.section
       FROM seats s
       WHERE s.event_id = $1 AND s.section = $2 AND s.status = 'available'
         AND NOT EXISTS (
           SELECT 1 FROM seat_holds sh WHERE sh.seat_id = s.id AND sh.expires_at > NOW()
         )
       ORDER BY s.row_label ASC, s.seat_number ASC
       FOR UPDATE SKIP LOCKED`,
      [eventId, zone_name]
    );
    const availableSeats = seatsRes.rows;

    if (availableSeats.length < qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        msg: `Chỉ còn ${availableSeats.length} ghế trống trong ${zone_name}`,
        available: availableSeats.length,
        retry: availableSeats.length > 0
      });
    }

    // Algorithm: Tìm N ghế cạnh nhau trong cùng 1 hàng (sliding window)
    let bestGroup = null;
    const rowGroups = {};
    for (const seat of availableSeats) {
      if (!rowGroups[seat.row_label]) rowGroups[seat.row_label] = [];
      rowGroups[seat.row_label].push(seat);
    }

    const sortedRowLabels = Object.keys(rowGroups).sort();
    for (const rowLabel of sortedRowLabels) {
      const rowSeats = rowGroups[rowLabel];
      for (let i = 0; i <= rowSeats.length - qty; i++) {
        const group = rowSeats.slice(i, i + qty);
        let contiguous = true;
        for (let j = 1; j < group.length; j++) {
          if (group[j].seat_number !== group[j-1].seat_number + 1) {
            contiguous = false;
            break;
          }
        }
        if (contiguous) {
          bestGroup = { seats: group, contiguous: true };
          break;
        }
      }
      if (bestGroup) break;
    }

    // Fallback: không có liền kề → lấy N ghế gần sân khấu nhất
    if (!bestGroup) {
      bestGroup = { seats: availableSeats.slice(0, qty), contiguous: false };
    }

    const holdExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const heldSeatIds = bestGroup.seats.map(s => s.id);

    await client.query(
      `UPDATE seats SET status = 'held' WHERE id = ANY($1)`,
      [heldSeatIds]
    );

    for (const seatId of heldSeatIds) {
      await client.query(
        `INSERT INTO seat_holds (seat_id, user_id, expires_at) VALUES ($1, $2, $3)`,
        [seatId, req.user.id, holdExpiry]
      );
    }

    await client.query('COMMIT');

    const totalPrice = bestGroup.seats.reduce((sum, s) => sum + parseFloat(s.price), 0);

    res.json({
      success: true,
      zone_name,
      zone_id: zone.id,
      is_contiguous: bestGroup.contiguous,
      quantity: qty,
      total: totalPrice,
      expires_at: holdExpiry.toISOString(),
      held_seat_ids: heldSeatIds,
      seats_info: bestGroup.seats.map(s => ({
        id: s.id,
        row: s.row_label,
        seat: s.seat_number,
        label: `${s.row_label}${s.seat_number}`,
        price: parseFloat(s.price)
      }))
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BestAvailable] Error:', err.message);
    res.status(500).json({ msg: 'Lỗi Server khi tìm ghế' });
  } finally {
    client.release();
  }
});

// POST /api/seats/hold
router.post('/seats/hold', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { seat_ids } = req.body;
    const user_id = req.user.id;
    const MAX_SEATS = 4;
    const HOLD_MINUTES = 10;

    if (!seat_ids || !Array.isArray(seat_ids) || seat_ids.length === 0) {
      return res.status(400).json({ msg: "Vui lòng chọn ít nhất 1 ghế!" });
    }
    if (seat_ids.length > MAX_SEATS) {
      return res.status(400).json({ msg: `Tối đa ${MAX_SEATS} ghế mỗi lần!` });
    }

    await client.query('BEGIN');

    // Cleanup expired holds
    await client.query(`
      UPDATE seats SET status = 'available'
      WHERE id IN (SELECT seat_id FROM seat_holds WHERE expires_at < NOW())
      AND status = 'held'
    `);
    await client.query("DELETE FROM seat_holds WHERE expires_at < NOW()");

    // Giải phóng ghế cũ user đang hold (nếu có)
    const oldHolds = await client.query(
      "SELECT seat_id FROM seat_holds WHERE user_id = $1",
      [user_id]
    );
    if (oldHolds.rows.length > 0) {
      const oldIds = oldHolds.rows.map(h => h.seat_id);
      await client.query(
        `UPDATE seats SET status = 'available' WHERE id = ANY($1) AND status = 'held'`,
        [oldIds]
      );
      await client.query("DELETE FROM seat_holds WHERE user_id = $1", [user_id]);
    }

    // SELECT FOR UPDATE SKIP LOCKED — Anti Race Condition
    const lockQuery = `
      SELECT id, status FROM seats
      WHERE id = ANY($1) AND status = 'available'
      FOR UPDATE SKIP LOCKED
    `;
    const locked = await client.query(lockQuery, [seat_ids]);

    if (locked.rows.length !== seat_ids.length) {
      await client.query('ROLLBACK');
      const lockedIds = locked.rows.map(r => r.id);
      const failedIds = seat_ids.filter(id => !lockedIds.includes(id));
      return res.status(409).json({
        msg: "Một số ghế đã được người khác chọn!",
        failed_seat_ids: failedIds
      });
    }

    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);

    await client.query(
      `UPDATE seats SET status = 'held' WHERE id = ANY($1)`,
      [seat_ids]
    );

    for (const seat_id of seat_ids) {
      await client.query(
        "INSERT INTO seat_holds (seat_id, user_id, expires_at) VALUES ($1, $2, $3)",
        [seat_id, user_id, expiresAt]
      );
    }

    await client.query('COMMIT');

    res.json({
      msg: `Đã giữ ${seat_ids.length} ghế trong ${HOLD_MINUTES} phút!`,
      held_seats: seat_ids,
      expires_at: expiresAt.toISOString()
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  } finally {
    client.release();
  }
});

// POST /api/seats/release
router.post('/seats/release', auth, async (req, res) => {
  try {
    const user_id = req.user.id;

    const holds = await db.query(
      "SELECT seat_id FROM seat_holds WHERE user_id = $1",
      [user_id]
    );

    if (holds.rows.length === 0) {
      return res.json({ msg: "Không có ghế nào đang được giữ" });
    }

    const seatIds = holds.rows.map(h => h.seat_id);
    await db.query(
      `UPDATE seats SET status = 'available' WHERE id = ANY($1) AND status = 'held'`,
      [seatIds]
    );
    await db.query("DELETE FROM seat_holds WHERE user_id = $1", [user_id]);

    res.json({ msg: `Đã giải phóng ${seatIds.length} ghế`, released: seatIds });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// POST /api/seats/book
router.post('/seats/book', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { seat_ids } = req.body;
    const user_id = req.user.id;

    if (!seat_ids || seat_ids.length === 0) {
      return res.status(400).json({ msg: "Vui lòng chọn ghế!" });
    }

    await client.query('BEGIN');

    const holdsRes = await client.query(
      `SELECT sh.seat_id, s.price, s.section, s.row_label, s.seat_number, s.event_id
       FROM seat_holds sh
       JOIN seats s ON sh.seat_id = s.id
       WHERE sh.user_id = $1 AND sh.seat_id = ANY($2) AND sh.expires_at > NOW()
       FOR UPDATE`,
      [user_id, seat_ids]
    );

    if (holdsRes.rows.length !== seat_ids.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        msg: "Thời gian giữ chỗ đã hết hoặc ghế không hợp lệ! Vui lòng chọn lại."
      });
    }

    const eventId = holdsRes.rows[0].event_id;
    const totalPrice = holdsRes.rows.reduce((sum, s) => sum + parseFloat(s.price), 0);

    await client.query(
      `UPDATE seats SET status = 'sold' WHERE id = ANY($1)`,
      [seat_ids]
    );

    await client.query(
      "DELETE FROM seat_holds WHERE seat_id = ANY($1)",
      [seat_ids]
    );

    const platform_fee = totalPrice * PLATFORM_FEE_RATE;
    const net_revenue = totalPrice * ORGANIZER_SHARE;

    const orderRes = await client.query(
      "INSERT INTO orders (user_id, event_id, status, total_price, platform_fee, net_revenue) VALUES ($1, $2, 'completed', $3, $4, $5) RETURNING id",
      [user_id, eventId, totalPrice, platform_fee, net_revenue]
    );
    const orderId = orderRes.rows[0].id;

    const ticketRes = await client.query(
      "SELECT id, price FROM tickets WHERE event_id = $1 LIMIT 1",
      [eventId]
    );
    const ticketId = ticketRes.rows.length > 0 ? ticketRes.rows[0].id : null;

    if (ticketId) {
      await client.query(
        "INSERT INTO order_items (order_id, ticket_id, quantity_ordered, price_at_purchase) VALUES ($1, $2, $3, $4)",
        [orderId, ticketId, seat_ids.length, totalPrice / seat_ids.length]
      );
    }

    await client.query('COMMIT');

    const seatLabels = holdsRes.rows.map(s =>
      `${s.section} - ${s.row_label}${s.seat_number}`
    );

    res.status(201).json({
      msg: "Đặt vé thành công!",
      order_id: orderId,
      seats: seatLabels,
      total: totalPrice
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send("Lỗi Server khi đặt vé");
  } finally {
    client.release();
  }
});

// POST /api/zones/purchase
router.post('/zones/purchase', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { zone_id, quantity } = req.body;
    const user_id = req.user.id;

    if (!zone_id || !quantity || quantity < 1) {
      return res.status(400).json({ msg: "Dữ liệu không hợp lệ!" });
    }
    if (quantity > 4) {
      return res.status(400).json({ msg: "Tối đa 4 vé mỗi lần!" });
    }

    await client.query('BEGIN');

    const zoneRes = await client.query(
      "SELECT * FROM venue_zones WHERE id = $1 FOR UPDATE",
      [zone_id]
    );

    if (zoneRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: "Khu vực không tồn tại!" });
    }

    const zone = zoneRes.rows[0];
    const available = zone.capacity - zone.sold;

    if (available < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: `Khu vực ${zone.name} chỉ còn ${available} chỗ!` });
    }

    await client.query(
      "UPDATE venue_zones SET sold = sold + $1 WHERE id = $2",
      [quantity, zone_id]
    );

    const totalPrice = quantity * zone.price;
    const platformFee = totalPrice * PLATFORM_FEE_RATE;
    const netRevenue = totalPrice * ORGANIZER_SHARE;

    const orderRes = await client.query(
      "INSERT INTO orders (user_id, event_id, status, total_price, platform_fee, net_revenue) VALUES ($1, $2, 'completed', $3, $4, $5) RETURNING id",
      [user_id, zone.event_id, totalPrice, platformFee, netRevenue]
    );
    const orderId = orderRes.rows[0].id;

    const ticketRes = await client.query(
      "SELECT id FROM tickets WHERE event_id = $1 LIMIT 1",
      [zone.event_id]
    );
    if (ticketRes.rows.length > 0) {
      await client.query(
        "INSERT INTO order_items (order_id, ticket_id, quantity_ordered, price_at_purchase) VALUES ($1, $2, $3, $4)",
        [orderId, ticketRes.rows[0].id, quantity, zone.price]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      msg: `Đặt ${quantity} vé ${zone.name} thành công!`,
      order_id: orderId,
      zone: zone.name,
      total: zone.price * quantity
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  } finally {
    client.release();
  }
});

module.exports = router;
