/**
 * Payment Routes Module
 * Handles all payment operations with VNPay
 */

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const {
  createPaymentUrl,
  verifyReturnParams,
  generateOrderId,
} = require('../utils/vnpayPayment');
const {
  generateQRCode,
  sendTicketConfirmationEmail,
} = require('../utils/ticketService');

const router = express.Router();

router.post('/init', auth, async (req, res) => {
  let client;
  try {
    client = await db.pool.connect();
    
    const userId = req.user.id;
    const { 
      seat_ids = [], 
      ticket_id = null,
      ticket_quantity = null,
      zone_id = null,
      quantity: zone_quantity = null,
      schedule_id = null
    } = req.body;

    // Validate input - must have seats OR ticket_id OR zone_id
    if ((!Array.isArray(seat_ids) || seat_ids.length === 0) && !ticket_id && !zone_id) {
      return res.status(400).json({ 
        success: false,
        msg: 'Vui lòng chọn ghế hoặc vé' 
      });
    }

    // Start transaction
    await client.query('BEGIN');

    let event_id = null;
    let total_amount = 0;
    let orderItems = [];

    // Process seat purchases
    if (Array.isArray(seat_ids) && seat_ids.length > 0) {
      // Lock tất cả ghế bằng FOR UPDATE để chặn concurrent requests
      const seatsRes = await client.query(
        `SELECT s.id, s.price, s.event_id, s.status 
         FROM seats s 
         WHERE s.id = ANY($1)
         FOR UPDATE`,
        [seat_ids]
      );

      if (seatsRes.rows.length !== seat_ids.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false,
          msg: 'Một số ghế không tồn tại' 
        });
      }

      // Check all seats belong to same event
      const eventIds = new Set(seatsRes.rows.map(s => s.event_id));
      if (eventIds.size !== 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false,
          msg: 'Các ghế phải thuộc cùng một sự kiện' 
        });
      }

      event_id = seatsRes.rows[0].event_id;

      // Chỉ block ghế đã bán hoặc đang held bởi NGƯỜI KHÁC (không block hold của chính mình)
      const soldSeats = seatsRes.rows.filter(s => s.status === 'sold');
      if (soldSeats.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ 
          success: false,
          msg: `Ghế đã được bán. Vui lòng chọn ghế khác.`,
          retry: true
        });
      }

      // Kiểm tra seat_holds: chỉ từ chối nếu ghế đang bị giữ bởi NGƯỜI KHÁC
      const otherHoldsRes = await client.query(
        `SELECT seat_id FROM seat_holds 
         WHERE seat_id = ANY($1) AND expires_at > NOW() AND user_id != $2`,
        [seat_ids, userId]
      );
      if (otherHoldsRes.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ 
          success: false,
          msg: 'Một hoặc nhiều ghế vừa được người khác giữ. Vui lòng chọn lại.',
          retry: true
        });
      }

      // Calculate total
      seatsRes.rows.forEach(seat => {
        total_amount += parseFloat(seat.price);
        orderItems.push({
          type: 'seat',
          seat_id: seat.id,
          price: parseFloat(seat.price),
          quantity: 1
        });
      });
    }

    // Process ticket-catalog purchases
    if (ticket_id) {
      const ticketQty = parseInt(ticket_quantity) || 1;
      
      // FOR UPDATE: lock hàng ticket, chặn mọi concurrent request đọc cùng lúc
      const ticketRes = await client.query(
        `SELECT t.id, t.type, t.price, t.event_id, t.quantity_available, t.quantity_held
         FROM tickets t 
         WHERE t.id = $1
         FOR UPDATE`,
        [ticket_id]
      );

      if (ticketRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false,
          msg: 'Loại vé không tồn tại' 
        });
      }

      const ticket = ticketRes.rows[0];
      
      // Tồn kho thực = quantity_available - quantity_held (đang bị giữ bởi người khác)
      const effectiveAvailable = ticket.quantity_available - (ticket.quantity_held || 0);
      if (effectiveAvailable < ticketQty) {
        await client.query('ROLLBACK');
        return res.status(409).json({ 
          success: false,
          msg: effectiveAvailable <= 0
            ? `Vé "${ticket.type}" đã hết. Vui lòng chọn loại vé khác.`
            : `Chỉ còn ${effectiveAvailable} vé loại "${ticket.type}" có sẵn`,
          retry: false
        });
      }

      if (!event_id) {
        event_id = ticket.event_id;
      } else if (event_id !== ticket.event_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false,
          msg: 'Các mục phải thuộc cùng một sự kiện' 
        });
      }

      // Tăng quantity_held ngay lập tức — giữ chỗ cho người này
      await client.query(
        `UPDATE tickets SET quantity_held = quantity_held + $1 WHERE id = $2`,
        [ticketQty, ticket_id]
      );

      const ticketPrice = parseFloat(ticket.price) * ticketQty;
      total_amount += ticketPrice;
      orderItems.push({
        type: 'ticket',
        ticket_id: ticket.id,
        ticket_type: ticket.type,
        price: parseFloat(ticket.price),
        quantity: ticketQty
      });
    }

    // Process zone purchases
    if (zone_id) {
      const zoneQty = parseInt(zone_quantity) || 1;
      if (zoneQty < 1 || zoneQty > 4) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, msg: 'Số lượng vé khu vực phải từ 1 đến 4' });
      }

      // FOR UPDATE: lock zone row, chặn concurrent requests
      const zoneRes = await client.query(
        `SELECT id, name, price, capacity, sold, quantity_held, event_id
         FROM venue_zones WHERE id = $1
         FOR UPDATE`,
        [zone_id]
      );

      if (zoneRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, msg: 'Khu vực không tồn tại' });
      }

      const zone = zoneRes.rows[0];
      // Tồn kho thực = capacity - sold - đang được giữ
      const effectiveAvailable = zone.capacity - zone.sold - (zone.quantity_held || 0);
      if (effectiveAvailable < zoneQty) {
        await client.query('ROLLBACK');
        return res.status(409).json({ 
          success: false, 
          msg: effectiveAvailable <= 0
            ? `Khu vực "${zone.name}" đã hết chỗ.`
            : `Khu vực "${zone.name}" chỉ còn ${effectiveAvailable} chỗ.`,
          retry: false
        });
      }

      if (!event_id) {
        event_id = zone.event_id;
      }

      // Tăng quantity_held ngay lập tức — giữ chỗ
      await client.query(
        `UPDATE venue_zones SET quantity_held = quantity_held + $1 WHERE id = $2`,
        [zoneQty, zone_id]
      );

      const zonePrice = parseFloat(zone.price) * zoneQty;
      total_amount += zonePrice;
      orderItems.push({
        type: 'zone',
        zone_id: zone.id,
        zone_name: zone.name,
        price: parseFloat(zone.price),
        quantity: zoneQty
      });
    }

    // Validate total amount
    if (total_amount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false,
        msg: 'Tổng tiền không hợp lệ' 
      });
    }

    // Validate event exists and is active
    const eventRes = await client.query(
      `SELECT id, title FROM events WHERE id = $1 AND status = 'published'`,
      [event_id]
    );

    if (eventRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false,
        msg: 'Sự kiện không tồn tại hoặc chưa được duyệt' 
      });
    }

    // Tính phí dịch vụ 3.5% — khách trả = giá vé + phí dịch vụ
    const PLATFORM_FEE_RATE = 0.035;
    const commission = Math.round(total_amount * PLATFORM_FEE_RATE);
    const customer_total = total_amount + commission;  // Tổng khách phải trả
    const net_amount = total_amount;                   // Tiền thực của organizer
    const vnpayAmount = Math.round(customer_total);    // Gửi đúng số tiền có phí lên VNPay

    // Create order record
    const orderCode = generateOrderId();
    const orderRes = await client.query(
      `INSERT INTO orders 
       (user_id, event_id, order_code, total_amount, commission, net_amount, status, payment_method, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'vnpay', NOW() + INTERVAL '10 minutes')
       RETURNING id, order_code, total_amount, commission, net_amount`,
      [userId, event_id, orderCode, customer_total, commission, net_amount]
    );

    const orderId = orderRes.rows[0].id;

    // Insert order items
    for (const item of orderItems) {
      if (item.type === 'seat') {
        await client.query(
          `INSERT INTO order_items 
           (order_id, seat_id, quantity, unit_price, total_price, status)
           VALUES ($1, $2, 1, $3, $4, 'pending')`,
          [orderId, item.seat_id, item.price, item.price]
        );
      } else if (item.type === 'ticket') {
        await client.query(
          `INSERT INTO order_items 
           (order_id, ticket_id, quantity, unit_price, total_price, status, schedule_id)
           VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
          [orderId, item.ticket_id, item.quantity, item.price, item.quantity * item.price, schedule_id || null]
        );
      } else if (item.type === 'zone') {
        await client.query(
          `INSERT INTO order_items 
           (order_id, zone_id, quantity, unit_price, total_price, status)
           VALUES ($1, $2, $3, $4, $5, 'pending')`,
          [orderId, item.zone_id, item.quantity, item.price, item.quantity * item.price]
        );
      }
    }

    // Create/update seat holds — UPSERT cho phép cập nhật hold của chính mình (best-available)
    if (Array.isArray(seat_ids) && seat_ids.length > 0) {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);
      
      for (const seatId of seat_ids) {
        // DO UPDATE chỉ cho user_id của mình — không ghi đè hold của người khác
        const holdResult = await client.query(
          `INSERT INTO seat_holds (user_id, seat_id, expires_at, order_id, status)
           VALUES ($1, $2, $3, $4, 'held')
           ON CONFLICT (seat_id) DO UPDATE 
             SET expires_at = EXCLUDED.expires_at, order_id = EXCLUDED.order_id, status = 'held'
             WHERE seat_holds.user_id = EXCLUDED.user_id`,
          [userId, seatId, expiresAt, orderId]
        );

        // rowCount = 0 có nghĩa là ghế đang bị người KHÁC hold (DO UPDATE WHERE không khớp)
        if (holdResult.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            msg: 'Một hoặc nhiều ghế vừa được người khác giữ. Vui lòng chọn lại.',
            retry: true
          });
        }
      }

      // Đánh dấu ghế là held trong bảng seats
      await client.query(
        `UPDATE seats SET status = 'held' WHERE id = ANY($1)`,
        [seat_ids]
      );
    }

    // Create ticket_hold record để background job có thể expire và trả vé về kho
    if (ticket_id) {
      const ticketItem = orderItems.find(i => i.type === 'ticket');
      if (ticketItem) {
        await client.query(
          `INSERT INTO ticket_holds (ticket_id, order_id, user_id, quantity, expires_at, status)
           VALUES ($1, $2, $3, $4, NOW() + INTERVAL '15 minutes', 'held')`,
          [ticketItem.ticket_id, orderId, userId, ticketItem.quantity]
        );
      }
    }

    // Log transaction
    await client.query(
      `INSERT INTO transaction_logs 
       (order_id, action, status, amount, metadata)
       VALUES ($1, 'initiate', 'pending', $2, $3)`,
      [orderId, total_amount, JSON.stringify({ seat_ids, ticket_id, zone_id })]
    );

    // Build order description for VNPay (ASCII-safe, max 255 chars)
    let orderDescription = `TiTicket ${eventRes.rows[0].title}`;
    if (Array.isArray(seat_ids) && seat_ids.length > 0) {
      orderDescription += ` ${seat_ids.length} ghe`;
    } else if (ticket_id) {
      const ticketItem = orderItems.find(item => item.type === 'ticket');
      if (ticketItem) orderDescription += ` ${ticketItem.quantity} ve ${ticketItem.ticket_type}`;
    } else if (zone_id) {
      const zoneItem = orderItems.find(item => item.type === 'zone');
      if (zoneItem) orderDescription += ` ${zoneItem.quantity} ve khu vuc ${zoneItem.zone_name}`;
    }

    // Tạo VNPay payment URL — đúng bằng giá vé, không phí
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const paymentUrl = createPaymentUrl({
      orderId:   orderCode,
      amount:    vnpayAmount,
      orderInfo: orderDescription,
      ipAddr:    clientIp,
    });

    // Lưu payment record
    await client.query(
      `INSERT INTO payments 
       (order_id, request_id, amount, status, raw_response)
       VALUES ($1, $2, $3, 'processing', $4)
       RETURNING id`,
      [orderId, orderCode, vnpayAmount, JSON.stringify({ provider: 'vnpay', orderCode })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      msg: 'Khởi tạo thanh toán thành công',
      order: {
        id: orderId,
        code: orderCode,
        base_amount:    total_amount,
        service_fee:    commission,
        total_amount:   vnpayAmount,
        net_amount:     parseFloat(orderRes.rows[0].net_amount)
      },
      payment: {
        payUrl:   paymentUrl,
        provider: 'vnpay'
      }
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('[Payment Init] Unexpected error:', error);
    res.status(500).json({
      success: false,
      msg: 'Lỗi hệ thống khi khởi tạo thanh toán',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
});

/**
 * POST /api/payments/vnpay/verify
 * Verify VNPay return params after user completes payment.
 * Frontend sends the full query string received from VNPay redirect.
 *
 * Works on localhost — VNPay uses redirect, not server-to-server callback.
 */
router.post('/vnpay/verify', auth, async (req, res) => {
  let client;
  try {
    const returnParams = req.body; // All query params from VNPay return URL
    const userId = req.user.id;

    // 1. Verify signature
    const verified = verifyReturnParams(returnParams);

    if (!verified.isValid) {
      return res.status(400).json({
        success: false,
        msg: 'Chữ ký VNPay không hợp lệ. Giao dịch có thể bị giả mạo.',
      });
    }

    const { orderCode, isSuccess, transactionId, responseCode, message, amount } = verified;

    client = await db.pool.connect();
    await client.query('BEGIN');

    // 2. Find order
    const orderRes = await client.query(
      'SELECT id, user_id, event_id, status FROM orders WHERE order_code = $1',
      [orderCode]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, msg: 'Không tìm thấy đơn hàng.' });
    }

    const order = orderRes.rows[0];

    // 3. Idempotency — already processed
    if (order.status === 'completed') {
      await client.query('ROLLBACK');
      return res.json({ success: true, msg: 'Đơn hàng đã được xử lý thành công.', orderCode });
    }
    if (order.status === 'failed' || order.status === 'expired') {
      await client.query('ROLLBACK');
      return res.status(410).json({ success: false, msg: 'Đơn hàng đã bị huỷ hoặc hết hạn.' });
    }

    // 4. Check expiry (in case background job hasn't run yet)
    const expCheck = await client.query(
      'SELECT expires_at FROM orders WHERE id = $1 AND expires_at < NOW()',
      [order.id]
    );
    if (expCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(410).json({
        success: false,
        msg: 'Đơn hàng đã hết hạn (quá 15 phút). Vui lòng đặt vé lại.',
        expired: true,
      });
    }

    // 5. Update payment record
    const vnpTransId = transactionId && transactionId !== '0' && transactionId !== 0
      ? String(transactionId) : null;
    await client.query(
      `UPDATE payments
       SET status = $1, vnpay_trans_id = $2, response_code = $3, verified_at = NOW(),
           raw_response = raw_response || $4
       WHERE order_id = $5`,
      [
        isSuccess ? 'completed' : 'failed',
        vnpTransId,
        responseCode,
        JSON.stringify({ vnp_response: returnParams }),
        order.id,
      ]
    );

    if (isSuccess) {
      // 6a. Payment success — get items and fulfill order

      const itemsRes = await client.query(
        `SELECT id as item_id, seat_id, ticket_id, zone_id, schedule_id,
                COALESCE(quantity, quantity_ordered, 1) as qty
         FROM order_items WHERE order_id = $1`,
        [order.id]
      );

      for (const item of itemsRes.rows) {
        if (item.seat_id) {
          await client.query(
            `UPDATE seats SET status = 'sold', sold_at = NOW() WHERE id = $1`,
            [item.seat_id]
          );
          await client.query(
            `DELETE FROM seat_holds WHERE seat_id = $1 AND order_id = $2`,
            [item.seat_id, order.id]
          );
        }
        if (item.ticket_id) {
          const upd = await client.query(
            `UPDATE tickets
             SET quantity_available = quantity_available - $1,
                 quantity_held      = GREATEST(0, quantity_held - $1)
             WHERE id = $2 AND quantity_available >= $1
             RETURNING id`,
            [item.qty, item.ticket_id]
          );
          if (upd.rowCount === 0) {
            console.error(`[CRITICAL] VNPay oversell ticket ${item.ticket_id} order ${order.id}`);
          }
          await client.query(
            `UPDATE ticket_holds SET status = 'confirmed' WHERE order_id = $1 AND ticket_id = $2`,
            [order.id, item.ticket_id]
          );
          // Cập nhật daily_sold trong schedule_tickets nếu đây là sự kiện nhiều lịch diễn
          if (item.schedule_id) {
            await client.query(
              `UPDATE schedule_tickets
               SET daily_sold = daily_sold + $1
               WHERE schedule_id = $2 AND ticket_id = $3`,
              [item.qty, item.schedule_id, item.ticket_id]
            );
          }
        }
        if (item.zone_id) {
          await client.query(
            `UPDATE venue_zones
             SET sold = sold + $1, quantity_held = GREATEST(0, quantity_held - $1)
             WHERE id = $2`,
            [item.qty, item.zone_id]
          );
        }
      }

      // Mark order completed
      await client.query(
        `UPDATE orders SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [order.id]
      );
      await client.query(
        `UPDATE order_items SET status = 'active' WHERE order_id = $1`,
        [order.id]
      );

      await client.query('COMMIT');

      // 7. Send confirmation email async (don't block response)
      setImmediate(async () => {
        try {
          const orderDetails = await db.pool.query(
            `SELECT o.order_code, o.total_amount, o.commission, e.title, e.event_date, e.location,
                    u.email, u.full_name
             FROM orders o
             JOIN events e ON e.id = o.event_id
             JOIN users u ON u.id = o.user_id
             WHERE o.id = $1`,
            [order.id]
          );
          if (orderDetails.rows.length > 0) {
            const od = orderDetails.rows[0];
            const ticketItemsRes = await db.pool.query(
              `SELECT oi.id, oi.seat_id, oi.ticket_id, oi.zone_id, COALESCE(oi.quantity, 1) as qty,
                      s.row_label, s.seat_number, s.section,
                      t.type AS ticket_type,
                      vz.name as zone_name
               FROM order_items oi
               LEFT JOIN seats s ON s.id = oi.seat_id
               LEFT JOIN tickets t ON t.id = oi.ticket_id
               LEFT JOIN venue_zones vz ON vz.id = oi.zone_id
               WHERE oi.order_id = $1`,
              [order.id]
            );

            // Generate QR codes — one QR per physical ticket (expand by qty)
            const ticketsWithQR = [];
            for (const item of ticketItemsRes.rows) {
              const qty = parseInt(item.qty) || 1;
              for (let i = 0; i < qty; i++) {
                // Use a sub-index so each QR is unique
                const qrResult = await generateQRCode(
                  item.ticket_id || item.seat_id || item.zone_id,
                  `${item.id}-${i + 1}`,
                  order.event_id
                );
                if (qrResult.success) {
                  ticketsWithQR.push({
                    ticketId: item.ticket_id || item.seat_id || item.zone_id,
                    orderItemId: `${item.id}-${i + 1}`,
                    qrCode: qrResult.qrCode,
                    encryptedId: qrResult.encryptedId,
                    quantity: 1,
                  });
                }
              }
            }

            // Determine ticket type label
            const firstItem = ticketItemsRes.rows[0];
            let ticketType = 'Vé';
            if (firstItem?.ticket_type) ticketType = firstItem.ticket_type;
            else if (firstItem?.zone_name) ticketType = firstItem.zone_name;
            else if (firstItem?.section) ticketType = `Ghế ${firstItem.section}`;

            await sendTicketConfirmationEmail({
              customerEmail: od.email,
              customerName:  od.full_name,
              eventTitle:    od.title,
              eventDate:     od.event_date,
              eventVenue:    od.location || 'Không rõ',
              ticketType,
              quantity:      ticketItemsRes.rows.reduce((sum, r) => sum + r.qty, 0),
              orderCode:     od.order_code,
              totalAmount:   od.total_amount,
              tickets:       ticketsWithQR,
            });
          }
        } catch (emailErr) {
          console.error('[VNPay] Email error (non-critical):', emailErr.message);
        }
      });

      return res.json({
        success: true,
        msg: 'Thanh toán thành công!',
        orderCode,
        transactionId,
      });

    } else {
      // 6b. Payment failed — release holds

      const failItems = await client.query(
        `SELECT seat_id, ticket_id, zone_id, COALESCE(quantity, quantity_ordered, 1) as qty
         FROM order_items WHERE order_id = $1`,
        [order.id]
      );
      for (const item of failItems.rows) {
        if (item.seat_id) {
          await client.query(
            `UPDATE seats SET status = 'available', sold_at = NULL WHERE id = $1 AND status = 'held'`,
            [item.seat_id]
          );
        }
        if (item.ticket_id) {
          await client.query(
            `UPDATE tickets SET quantity_held = GREATEST(0, quantity_held - $1) WHERE id = $2`,
            [item.qty, item.ticket_id]
          );
        }
        if (item.zone_id) {
          await client.query(
            `UPDATE venue_zones SET quantity_held = GREATEST(0, quantity_held - $1) WHERE id = $2`,
            [item.qty, item.zone_id]
          );
        }
      }

      await client.query(
        `UPDATE ticket_holds SET status = 'released' WHERE order_id = $1 AND status = 'held'`,
        [order.id]
      );
      await client.query(`DELETE FROM seat_holds WHERE order_id = $1`, [order.id]);
      await client.query(
        `UPDATE orders SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [order.id]
      );
      await client.query(
        `UPDATE order_items SET status = 'cancelled' WHERE order_id = $1`,
        [order.id]
      );

      await client.query('COMMIT');

      return res.status(400).json({
        success: false,
        msg: message || 'Thanh toán thất bại.',
        responseCode,
        orderCode,
      });
    }

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('[VNPay Verify] Error:', error);
    return res.status(500).json({ success: false, msg: 'Lỗi hệ thống khi xác nhận thanh toán.' });
  } finally {
    if (client) client.release();
  }
});

/**
 * POST /api/payments/webhook
 * Legacy VNPay IPN endpoint — kept for backward compatibility.
 * Not used with VNPay.
 */

router.post('/webhook', async (req, res) => {
  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    const webhookData = req.body;
    const { 
      orderId, 
      signature, 
      resultCode, 
      transId,
      requestId,
      amount
    } = webhookData;

    console.log('[VNPay IPN] Received:', { orderId, resultCode, transId });

    // Find order by code
    const orderRes = await client.query(
      'SELECT id, user_id, event_id, status FROM orders WHERE order_code = $1',
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      console.error('[VNPay IPN] Order not found:', orderId);
      // Still return 200 to VNPay so it doesn't retry indefinitely
      return res.status(200).json({ message: 'Order not found' });
    }

    const order = orderRes.rows[0];

    // Idempotency check — skip if already processed
    if (order.status === 'completed' || order.status === 'failed') {
      await client.query('ROLLBACK');
      console.log('[VNPay IPN] Order already processed:', { orderId, status: order.status });
      return res.status(200).json({ message: 'Already processed' });
    }

    // Verify signature using our own secret key
    const signatureValid = verifyWebhookSignature(webhookData, signature);

    if (!signatureValid) {
      await client.query('ROLLBACK');
      console.error('[VNPay IPN] Invalid signature for orderId:', orderId);
      // Return 200 to prevent VNPay retries, but log the security event
      return res.status(200).json({ message: 'Invalid signature' });
    }

    // Update payment record
    const paymentRes = await client.query(
      `UPDATE payments 
       SET vnpay_trans_id = $1, response_code = $2, status = $3, verified_at = NOW(), raw_response = $4
       WHERE order_id = $5
       RETURNING id`,
      [
        transId || null,
        resultCode,
        resultCode === 0 ? 'completed' : 'failed',
        JSON.stringify(webhookData),
        order.id
      ]
    );

    // Handle case where payment record doesn't exist yet
    let paymentId = null;
    if (paymentRes.rows.length > 0) {
      paymentId = paymentRes.rows[0].id;
    } else {
      // Create payment record if missing (edge case)
      const newPayment = await client.query(
        `INSERT INTO payments (order_id, request_id, vnpay_trans_id, amount, status, response_code, verified_at, raw_response)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
         RETURNING id`,
        [order.id, requestId || '', transId || '', amount, resultCode === 0 ? 'completed' : 'failed', resultCode, JSON.stringify(webhookData)]
      );
      paymentId = newPayment.rows[0].id;
    }

    const resultInfo = parseResultCode(resultCode);

    if (resultCode === 0) {
      // ── Payment successful ──────────────────────────────────────────────
      
      // Get order items (bao gồm zone_id)
      const itemsRes = await client.query(
        `SELECT id as item_id, seat_id, ticket_id, zone_id, COALESCE(quantity, quantity_ordered, 1) as qty FROM order_items WHERE order_id = $1`,
        [order.id]
      );

      for (const item of itemsRes.rows) {
        if (item.seat_id) {
          // Mark seat as sold
          await client.query(
            `UPDATE seats SET status = 'sold', sold_at = NOW() WHERE id = $1`,
            [item.seat_id]
          );

          // Remove seat hold
          await client.query(
            `DELETE FROM seat_holds WHERE seat_id = $1 AND order_id = $2`,
            [item.seat_id, order.id]
          );
        }

        if (item.ticket_id) {
          // Giảm quantity_available và giải phóng quantity_held cùng lúc
          const updateResult = await client.query(
            `UPDATE tickets 
             SET quantity_available = quantity_available - $1,
                 quantity_held      = GREATEST(0, quantity_held - $1)
             WHERE id = $2 AND quantity_available >= $1
             RETURNING id`,
            [item.qty, item.ticket_id]
          );
          if (updateResult.rowCount === 0) {
            console.error(`[CRITICAL] Oversell detected for ticket ${item.ticket_id}, order ${order.id}. Manual review required!`);
          }
          await client.query(
            `UPDATE ticket_holds SET status = 'confirmed' WHERE order_id = $1 AND ticket_id = $2`,
            [order.id, item.ticket_id]
          );
        }

        if (item.zone_id) {
          // Zone: tăng sold, giảm quantity_held
          await client.query(
            `UPDATE venue_zones 
             SET sold = sold + $1,
                 quantity_held = GREATEST(0, quantity_held - $1)
             WHERE id = $2`,
            [item.qty, item.zone_id]
          );
        }
      }

      // Mark order as completed
      await client.query(
        `UPDATE orders SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [order.id]
      );

      // Mark order items as confirmed
      await client.query(
        `UPDATE order_items SET status = 'confirmed' WHERE order_id = $1`,
        [order.id]
      );

      // Log success
      await client.query(
        `INSERT INTO transaction_logs 
         (order_id, payment_id, action, status, amount, new_status, metadata)
         VALUES ($1, $2, 'webhook_received', 'completed', $3, 'completed', $4)`,
        [order.id, paymentId, amount, JSON.stringify({ transId, resultCode: 0 })]
      );

      // ── Send confirmation email with QR codes ──────────────────────────
      try {
        // Get customer info
        const userRes = await client.query(
          'SELECT email, full_name FROM users WHERE id = $1',
          [order.user_id]
        );
        
        if (userRes.rows.length === 0) {
          throw new Error('User not found');
        }

        const customer = userRes.rows[0];
        const userEmail = customer.email;
        const customerName = customer.full_name || 'Khách hàng';

        // Get event info
        const eventRes = await client.query(
          'SELECT title, event_date as date_time, location as venue FROM events WHERE id = $1',
          [order.event_id]
        );

        if (eventRes.rows.length === 0) {
          throw new Error('Event not found');
        }

        const event = eventRes.rows[0];
        const eventDate = new Date(event.date_time).toLocaleDateString('vi-VN');

        // Get order details
        const orderDetailsRes = await client.query(
          'SELECT total_amount, order_code FROM orders WHERE id = $1',
          [order.id]
        );
        
        const orderDetails = orderDetailsRes.rows[0];

        // Generate QR codes for each ticket
        const ticketsData = [];
        for (const item of itemsRes.rows) {
          const qrResult = await generateQRCode(item.ticket_id || item.seat_id, item.item_id, order.event_id);
          
          if (qrResult.success) {
            ticketsData.push({
              ticketId: item.ticket_id || item.seat_id,
              orderItemId: item.item_id,
              qrCode: qrResult.qrCode,
              encryptedId: qrResult.encryptedId,
              quantity: item.qty,
            });
          }
        }

        // Get ticket type info
        let ticketType = 'Vé';
        let quantity = itemsRes.rows.reduce((sum, item) => sum + item.qty, 0);
        
        if (itemsRes.rows[0]?.ticket_id) {
          const ticketTypeRes = await client.query(
            'SELECT type FROM tickets WHERE id = $1',
            [itemsRes.rows[0].ticket_id]
          );
          if (ticketTypeRes.rows.length > 0) {
            ticketType = ticketTypeRes.rows[0].type;
          }
        }

        // Send email
        const emailResult = await sendTicketConfirmationEmail({
          customerEmail: userEmail,
          customerName,
          eventTitle: event.title,
          eventDate,
          eventVenue: event.venue || 'Không rõ',
          ticketType,
          quantity,
          orderCode: orderDetails.order_code,
          totalAmount: orderDetails.total_amount,
          tickets: ticketsData,
        });

        if (emailResult.success) {
          console.log(`[OK] Confirmation email sent to ${userEmail} for order ${orderDetails.order_code}`);
        } else {
          console.error(`[WARN] Failed to send email for order ${orderDetails.order_code}:`, emailResult.error);
        }
      } catch (emailError) {
        console.error('[WARN] Email sending error in webhook:', emailError.message);
        // Don't fail the webhook if email fails - log it but continue
      }

    } else {
      // ── Payment failed / cancelled ──────────────────────────────────────

      // Lấy order items để giải phóng holds
      const failedItemsRes = await client.query(
        `SELECT seat_id, ticket_id, zone_id, COALESCE(quantity, quantity_ordered, 1) as qty FROM order_items WHERE order_id = $1`,
        [order.id]
      );
      for (const item of failedItemsRes.rows) {
        if (item.seat_id) {
          // Trả ghế về trạng thái available
          await client.query(
            `UPDATE seats SET status = 'available', sold_at = NULL WHERE id = $1 AND status = 'held'`,
            [item.seat_id]
          );
        }
        if (item.ticket_id) {
          // Giải phóng quantity_held — trả vé về kho
          await client.query(
            `UPDATE tickets SET quantity_held = GREATEST(0, quantity_held - $1) WHERE id = $2`,
            [item.qty, item.ticket_id]
          );
        }
        if (item.zone_id) {
          // Giải phóng zone quantity_held
          await client.query(
            `UPDATE venue_zones SET quantity_held = GREATEST(0, quantity_held - $1) WHERE id = $2`,
            [item.qty, item.zone_id]
          );
        }
      }

      // Giải phóng ticket holds
      await client.query(
        `UPDATE ticket_holds SET status = 'released' WHERE order_id = $1 AND status = 'held'`,
        [order.id]
      );

      // Release seat holds
      await client.query(
        `DELETE FROM seat_holds WHERE order_id = $1`,
        [order.id]
      );

      // Mark order as failed
      await client.query(
        `UPDATE orders SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [order.id]
      );

      // Mark order items as cancelled
      await client.query(
        `UPDATE order_items SET status = 'cancelled' WHERE order_id = $1`,
        [order.id]
      );

      // Log failure
      await client.query(
        `INSERT INTO transaction_logs 
         (order_id, payment_id, action, status, amount, new_status, error_message, metadata)
         VALUES ($1, $2, 'webhook_received', 'failed', $3, 'failed', $4, $5)`,
        [order.id, paymentId, amount, resultInfo.message, JSON.stringify({ transId, resultCode })]
      );
    }

    await client.query('COMMIT');

    // Always return 200 to VNPay
    res.status(200).json({
      message: resultInfo.message,
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('[VNPay IPN] Unexpected error:', error);
    // Still return 200 to prevent VNPay from retrying infinitely
    res.status(200).json({ message: 'Internal error but acknowledged' });
  } finally {
    if (client) client.release();
  }
});

/**
 * GET /api/payments/orders/:orderId
 * Get order details and payment status (by numeric DB id)
 */
router.get('/orders/:orderId', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const orderRes = await db.query(
      `SELECT o.*, 
              COALESCE(json_agg(json_build_object(
                'id', oi.id,
                'seat_id', oi.seat_id,
                'zone_id', oi.zone_id,
                'ticket_id', oi.ticket_id,
                'unit_price', oi.unit_price,
                'total_price', oi.total_price,
                'quantity', oi.quantity,
                'status', oi.status
              )) FILTER (WHERE oi.id IS NOT NULL), '[]') as items,
              json_build_object(
                'id', p.id,
                'status', p.status,
                'vnpay_trans_id', p.vnpay_trans_id,
                'response_code', p.response_code,
                'verified_at', p.verified_at
              ) as payment
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN payments p ON o.id = p.order_id
       WHERE o.id = $1 AND o.user_id = $2
       GROUP BY o.id, p.id`,
      [orderId, userId]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ success: false, msg: 'Đơn hàng không tìm thấy' });
    }

    res.json({
      success: true,
      order: orderRes.rows[0]
    });

  } catch (error) {
    console.error('[Get Order]', error);
    res.status(500).json({
      success: false,
      msg: 'Lỗi lấy thông tin đơn hàng',
      error: error.message
    });
  }
});

/**
 * GET /api/payments/status/:orderCode
 * Check payment status by order code (used by frontend after VNPay redirect)
 * This endpoint is public (no auth) because VNPay redirects with the order code in the URL
 */
router.get('/status/:orderCode', async (req, res) => {
  try {
    const { orderCode } = req.params;

    const statusRes = await db.query(
      `SELECT o.order_code, o.status, o.total_amount, o.created_at,
              p.status as payment_status, p.vnpay_trans_id, p.response_code,
              p.verified_at
       FROM orders o
       LEFT JOIN payments p ON o.id = p.order_id
       WHERE o.order_code = $1`,
      [orderCode]
    );

    if (statusRes.rows.length === 0) {
      return res.status(404).json({ success: false, msg: 'Đơn hàng không tìm thấy' });
    }

    res.json({
      success: true,
      status: statusRes.rows[0]
    });

  } catch (error) {
    console.error('[Get Status]', error);
    res.status(500).json({
      success: false,
      msg: 'Lỗi kiểm tra trạng thái thanh toán',
      error: error.message
    });
  }
});

/**
 * POST /api/payments/confirm-mock
 * DEV ONLY — Simulates webhook callback for mock payments.
 * Called by frontend when returning from mock payment URL.
 */
router.post('/confirm-mock', auth, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, msg: 'Not available in production' });
  }

  let client;
  try {
    const { orderCode } = req.body;
    const userId = req.user.id;

    if (!orderCode) {
      return res.status(400).json({ success: false, msg: 'orderCode is required' });
    }

    client = await db.pool.connect();
    await client.query('BEGIN');

    // Find order
    const orderRes = await client.query(
      'SELECT id, user_id, event_id, status FROM orders WHERE order_code = $1 AND user_id = $2',
      [orderCode, userId]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, msg: 'Đơn hàng không tìm thấy' });
    }

    const order = orderRes.rows[0];

    // Idempotency
    if (order.status === 'completed') {
      await client.query('ROLLBACK');
      return res.json({ success: true, msg: 'Đơn hàng đã được xử lý' });
    }

    // Từ chối nếu order đã hết hạn hoặc thất bại
    if (order.status === 'expired') {
      await client.query('ROLLBACK');
      return res.status(410).json({ 
        success: false, 
        msg: 'Đơn hàng đã hết hạn (quá 15 phút). Vui lòng đặt vé lại.',
        expired: true
      });
    }
    if (order.status === 'failed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        msg: 'Đơn hàng đã bị huỷ.'
      });
    }

    // Kiểm tra order có hết hạn không (dù status vẫn pending — job chưa kịp chạy)
    const expiredCheck = await client.query(
      `SELECT expires_at FROM orders WHERE id = $1 AND expires_at < NOW()`,
      [order.id]
    );
    if (expiredCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(410).json({
        success: false,
        msg: 'Đơn hàng đã hết hạn (quá 15 phút). Vui lòng đặt vé lại.',
        expired: true
      });
    }

    // Create or update payment record
    const mockTransId = 'MOCK' + Date.now();
    
    // Check if payment already exists
    const existingPayRes = await client.query(
      'SELECT id FROM payments WHERE order_id = $1',
      [order.id]
    );

    let payRes;
    if (existingPayRes.rows.length > 0) {
      // Update existing payment
      payRes = await client.query(
        `UPDATE payments 
         SET vnpay_trans_id = $1, status = 'completed', response_code = '0', verified_at = NOW(), raw_response = $2
         WHERE order_id = $3 
         RETURNING id`,
        [mockTransId, JSON.stringify({ mock: true }), order.id]
      );
    } else {
      // Create new payment
      const orderData = await client.query(
        'SELECT total_amount FROM orders WHERE id = $1',
        [order.id]
      );
      
      if (orderData.rows.length === 0) {
        throw new Error('Order not found when creating payment record');
      }

      payRes = await client.query(
        `INSERT INTO payments (order_id, request_id, vnpay_trans_id, amount, status, response_code, verified_at, raw_response)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
         RETURNING id`,
        [order.id, 'mock', mockTransId, orderData.rows[0].total_amount, 'completed', '0', JSON.stringify({ mock: true })]
      );
    }

    // Process order items
    const itemsRes = await client.query(
      `SELECT id as item_id, seat_id, ticket_id, COALESCE(quantity, quantity_ordered, 1) as qty FROM order_items WHERE order_id = $1`,
      [order.id]
    );

    for (const item of itemsRes.rows) {
      if (item.seat_id) {
        await client.query(
          `UPDATE seats SET status = 'sold', sold_at = NOW() WHERE id = $1`,
          [item.seat_id]
        );
        await client.query(
          `DELETE FROM seat_holds WHERE seat_id = $1`,
          [item.seat_id]
        );
      }
      if (item.ticket_id) {
        await client.query(
          `UPDATE tickets SET quantity_available = quantity_available - $1
           WHERE id = $2 AND quantity_available >= $1`,
          [item.qty, item.ticket_id]
        );
      }
    }

    // Complete order
    await client.query(
      `UPDATE orders SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [order.id]
    );
    await client.query(
      `UPDATE order_items SET status = 'confirmed' WHERE order_id = $1`,
      [order.id]
    );

    await client.query('COMMIT');
    console.log('[Mock Payment] Order completed:', orderCode);

    // ── Send confirmation email with QR codes ──────────────────────────
    try {
      const userRes = await client.query(
        'SELECT email, full_name FROM users WHERE id = $1',
        [order.user_id]
      );
      
      if (userRes.rows.length === 0) {
        throw new Error('User not found');
      }

      const customer = userRes.rows[0];
      const userEmail = customer.email;
      const customerName = customer.full_name || 'Khách hàng';

      const eventRes = await client.query(
        'SELECT title, event_date as date_time, location as venue FROM events WHERE id = $1',
        [order.event_id]
      );

      if (eventRes.rows.length === 0) {
        throw new Error('Event not found');
      }

      const event = eventRes.rows[0];
      const eventDate = new Date(event.date_time).toLocaleDateString('vi-VN');

      const orderDetailsRes = await client.query(
        'SELECT total_amount, order_code FROM orders WHERE id = $1',
        [order.id]
      );
      
      const orderDetails = orderDetailsRes.rows[0];

      // Generate QR codes for each ticket
      const ticketsData = [];
      for (const item of itemsRes.rows) {
        const qrResult = await generateQRCode(item.ticket_id || item.seat_id, item.item_id, order.event_id);
        
        if (qrResult.success) {
          ticketsData.push({
            ticketId: item.ticket_id || item.seat_id,
            orderItemId: item.item_id,
            qrCode: qrResult.qrCode,
            encryptedId: qrResult.encryptedId,
            quantity: item.qty,
          });
        }
      }

      let ticketType = 'Vé';
      let quantity = itemsRes.rows.reduce((sum, item) => sum + item.qty, 0);
      
      if (itemsRes.rows[0]?.ticket_id) {
        const ticketTypeRes = await client.query(
          'SELECT type FROM tickets WHERE id = $1',
          [itemsRes.rows[0].ticket_id]
        );
        if (ticketTypeRes.rows.length > 0) {
          ticketType = ticketTypeRes.rows[0].type;
        }
      }

      const emailResult = await sendTicketConfirmationEmail({
        customerEmail: userEmail,
        customerName,
        eventTitle: event.title,
        eventDate,
        eventVenue: event.venue || 'Không rõ',
        ticketType,
        quantity,
        orderCode: orderDetails.order_code,
        totalAmount: orderDetails.total_amount,
        tickets: ticketsData,
      });

      if (emailResult.success) {
        console.log(`[OK] Confirmation email sent to ${userEmail} for order ${orderDetails.order_code}`);
      } else {
        console.error(`[WARN] Failed to send email for order ${orderDetails.order_code}:`, emailResult.error);
      }
    } catch (emailError) {
      console.error('[WARN] Email sending error in mock payment:', emailError.message);
    }

    res.json({ success: true, msg: 'Mock payment confirmed', orderCode });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('[Mock Payment] Error:', error);
    res.status(500).json({ success: false, msg: 'Lỗi xác nhận thanh toán mock', error: error.message });
  } finally {
    if (client) client.release();
  }
});

/**
 * GET /api/payments/eticket/:orderItemId
 * Get E-ticket details with QR code.
 * Supports ?sub=N query param: when a user buys N tickets of the same type,
 * each physical ticket gets its own unique QR via a sub-index suffix.
 * Accessible only by ticket owner.
 */
router.get('/eticket/:orderItemId', auth, async (req, res) => {
  let client;
  try {
    const { orderItemId } = req.params;
    // subIndex: 1-based index of this physical ticket within the order_item quantity
    const subIndex = parseInt(req.query.sub) || 1;
    const userId = req.user.id;

    client = await db.pool.connect();

    // Verify ownership and get ticket details
    const ticketRes = await client.query(
      `SELECT oi.id, oi.order_id, oi.seat_id, oi.ticket_id, oi.status, oi.unit_price,
              COALESCE(oi.quantity, oi.quantity_ordered, 1) as total_quantity,
              o.order_code, o.event_id, o.created_at,
              e.title as event_title, e.event_date as date_time, e.end_date, e.location as venue,
              u.full_name
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN events e ON o.event_id = e.id
       JOIN users u ON o.user_id = u.id
       WHERE oi.id = $1 AND o.user_id = $2 AND o.status = 'completed'`,
      [orderItemId, userId]
    );

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        msg: 'Vé không tìm thấy hoặc chưa được xác nhận'
      });
    }

    const ticket = ticketRes.rows[0];

    // Validate sub-index range
    const totalQty = parseInt(ticket.total_quantity) || 1;
    const validSub = Math.min(Math.max(subIndex, 1), totalQty);

    // Generate a unique QR per physical ticket by using orderItemId-subIndex as the identifier
    // This ensures each physical ticket has its own scannable, unique QR code
    const qrIdentifier = totalQty > 1 ? `${ticket.id}-${validSub}` : String(ticket.id);
    const qrResult = await generateQRCode(
      ticket.ticket_id || ticket.seat_id,
      qrIdentifier,
      ticket.event_id
    );

    if (!qrResult.success) {
      return res.status(500).json({
        success: false,
        msg: 'Lỗi tạo mã QR'
      });
    }

    // Xác định ngày hết hạn: dùng end_date cho sự kiện nhiều ngày, event_date cho sự kiện 1 ngày
    const expiryDate = ticket.end_date || ticket.date_time;

    res.json({
      success: true,
      ticket: {
        id: ticket.id,
        orderItemId: ticket.id,
        subIndex: validSub,
        totalQuantity: totalQty,
        orderCode: ticket.order_code,
        status: ticket.status,
        eventTitle: ticket.event_title,
        eventDate: new Date(ticket.date_time).toLocaleDateString('vi-VN'),
        eventDateTime: new Date(ticket.date_time).toLocaleString('vi-VN'),
        eventDateRaw: ticket.date_time, // ISO date for reliable comparison
        eventEndDateRaw: ticket.end_date, // end_date for multi-day events
        expiryDateRaw: expiryDate, // The actual date to check expiry against
        eventVenue: ticket.venue,
        price: parseFloat(ticket.unit_price),
        createdAt: ticket.created_at,
        customerName: ticket.full_name,
        qrCode: qrResult.qrCode,
        encryptedId: qrResult.encryptedId,
      }
    });

  } catch (error) {
    console.error('[E-ticket Get] Error:', error);
    res.status(500).json({
      success: false,
      msg: 'Lỗi lấy thông tin vé',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
});

/**
 * POST /api/payments/verify-ticket
 * Verify ticket validity at venue (admin/organizer only)
 * Used by venue staff to scan and verify QR codes
 */
router.post('/verify-ticket', async (req, res) => {
  try {
    const { encryptedId } = req.body;

    if (!encryptedId) {
      return res.status(400).json({
        success: false,
        msg: 'Mã vé không hợp lệ'
      });
    }

    // Verify encrypted ID
    const { valid, ticketId, orderItemId, eventId } = require('../utils/ticketService').verifyEncryptedTicketId(encryptedId);

    if (!valid) {
      return res.status(400).json({
        success: false,
        msg: 'Mã vé không hợp lệ hoặc đã bị tamper'
      });
    }

    // Check if ticket exists and is valid
    const ticketRes = await db.query(
      `SELECT oi.id, oi.status, oi.used_at, o.status as order_status, e.title
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN events e ON o.event_id = e.id
       WHERE oi.id = $1 AND o.event_id = $2`,
      [orderItemId, eventId]
    );

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        msg: 'Vé không tìm thấy'
      });
    }

    const ticket = ticketRes.rows[0];

    // Check status
    if (ticket.order_status !== 'completed') {
      return res.status(400).json({
        success: false,
        msg: 'Đơn hàng chưa hoàn tất'
      });
    }

    if (ticket.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        msg: `Vé không hợp lệ (trạng thái: ${ticket.status})`
      });
    }

    if (ticket.used_at) {
      return res.status(400).json({
        success: false,
        msg: 'Vé này đã được sử dụng',
        usedAt: ticket.used_at
      });
    }

    // Mark ticket as used
    await db.query(
      `UPDATE order_items SET status = 'used', used_at = NOW() WHERE id = $1`,
      [orderItemId]
    );

    res.json({
      success: true,
      msg: 'Vé hợp lệ - Check in thành công',
      ticket: {
        id: orderItemId,
        eventTitle: ticket.title,
        status: 'used'
      }
    });

  } catch (error) {
    console.error('[Verify Ticket] Error:', error);
    res.status(500).json({
      success: false,
      msg: 'Lỗi xác minh vé',
      error: error.message
    });
  }
});

module.exports = router;
