/**
 * Background Job: Expire Pending Orders
 * Runs every 60 seconds to clean up orders that passed their expiry time.
 *
 * For each expired pending order:
 *  1. Release ticket_holds → restore quantity_held
 *  2. Release seat_holds  → restore seats to 'available'
 *  3. Mark order as 'expired', order_items as 'cancelled'
 */

const db = require('../db');

const INTERVAL_MS = 60 * 1000; // Run every 60 seconds

async function expireOrders() {
  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // Find all pending orders that have passed expires_at
    const expiredRes = await client.query(
      `SELECT id FROM orders
       WHERE status = 'pending'
         AND expires_at IS NOT NULL
         AND expires_at < NOW()
       FOR UPDATE SKIP LOCKED`
    );

    if (expiredRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return;
    }

    const expiredIds = expiredRes.rows.map(r => r.id);
    console.log(`[ExpireOrders] Found ${expiredIds.length} expired order(s):`, expiredIds);

    // Get all items across expired orders
    const itemsRes = await client.query(
      `SELECT order_id, seat_id, ticket_id, zone_id, COALESCE(quantity, quantity_ordered, 1) as qty
       FROM order_items
       WHERE order_id = ANY($1)`,
      [expiredIds]
    );

    for (const item of itemsRes.rows) {
      if (item.seat_id) {
        // Restore seat to available
        await client.query(
          `UPDATE seats SET status = 'available', sold_at = NULL
           WHERE id = $1 AND status = 'held'`,
          [item.seat_id]
        );
      }

      if (item.ticket_id) {
        // Release quantity_held — return tickets to inventory
        await client.query(
          `UPDATE tickets
           SET quantity_held = GREATEST(0, quantity_held - $1)
           WHERE id = $2`,
          [item.qty, item.ticket_id]
        );
      }

      if (item.zone_id) {
        // Release zone quantity_held
        await client.query(
          `UPDATE venue_zones
           SET quantity_held = GREATEST(0, quantity_held - $1)
           WHERE id = $2`,
          [item.qty, item.zone_id]
        );
      }
    }

    // Release seat holds
    await client.query(
      `DELETE FROM seat_holds WHERE order_id = ANY($1)`,
      [expiredIds]
    );

    // Release ticket holds
    await client.query(
      `UPDATE ticket_holds SET status = 'released'
       WHERE order_id = ANY($1) AND status = 'held'`,
      [expiredIds]
    );

    // Mark orders as expired
    await client.query(
      `UPDATE orders SET status = 'expired', updated_at = NOW()
       WHERE id = ANY($1)`,
      [expiredIds]
    );

    // Mark order items as cancelled
    await client.query(
      `UPDATE order_items SET status = 'cancelled'
       WHERE order_id = ANY($1) AND status = 'pending'`,
      [expiredIds]
    );

    await client.query('COMMIT');
    console.log(`[ExpireOrders] [DONE] Expired ${expiredIds.length} order(s) and released holds.`);

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[ExpireOrders] [ERROR] Error during expiry job:', err.message);
  } finally {
    if (client) client.release();
  }
}

/**
 * Start the background job. Call this once at server startup.
 */
function startExpireOrdersJob() {
  console.log('[ExpireOrders] Background job started. Interval: 60s');
  // Run immediately on startup, then every 60s
  expireOrders();
  setInterval(expireOrders, INTERVAL_MS);
}

module.exports = { startExpireOrdersJob };
