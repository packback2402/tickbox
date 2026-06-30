-- =============================================
-- MIGRATION 006: Phân bổ vé theo ngày diễn
-- =============================================

CREATE TABLE IF NOT EXISTS schedule_tickets (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES event_schedules(id) ON DELETE CASCADE,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  daily_quantity INTEGER NOT NULL DEFAULT 0,
  daily_sold INTEGER NOT NULL DEFAULT 0,
  UNIQUE(schedule_id, ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_tickets_schedule ON schedule_tickets(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_tickets_ticket ON schedule_tickets(ticket_id);
