#!/bin/bash
# update.sh — Cập nhật TiTicket lên phiên bản mới nhất từ GitHub
# Chạy trên VPS: bash update.sh

set -e

echo "======================================"
echo "  TiTicket — Cập nhật hệ thống"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================"

# 1. Pull code mới nhất
echo ""
echo "[1/4] Pull code từ GitHub..."
git pull origin main
echo "✅ Code đã được cập nhật"

# 2. Chạy migration DB nếu cần (thêm cột schedule_id vào order_items)
echo ""
echo "[2/4] Chạy database migration..."
source .env 2>/dev/null || true

# Migration: thêm schedule_id vào order_items (idempotent - an toàn chạy nhiều lần)
docker compose exec -T db psql -U "${DB_USER}" -d "${DB_DATABASE}" -c "
  ALTER TABLE order_items ADD COLUMN IF NOT EXISTS schedule_id INTEGER REFERENCES event_schedules(id);
" && echo "✅ Migration OK" || echo "⚠️  Migration warning (có thể đã tồn tại)"

# 3. Rebuild chỉ frontend và backend (không rebuild DB và nginx)
echo ""
echo "[3/4] Rebuild containers..."
docker compose build --no-cache frontend backend
echo "✅ Build hoàn thành"

# 4. Restart containers
echo ""
echo "[4/4] Restart hệ thống..."
docker compose up -d --force-recreate frontend backend

# Chờ khởi động
sleep 8

# Health check
echo ""
if curl -sf http://localhost/api/health > /dev/null 2>&1; then
    echo "======================================"
    echo "  ✅ CẬP NHẬT THÀNH CÔNG!"
    echo "  🌐 https://titicket.id.vn"
    echo "======================================"
else
    echo "======================================"
    echo "  ⚠️  Đang khởi động, kiểm tra logs:"
    echo "  docker compose logs -f backend"
    echo "  docker compose logs -f frontend"
    echo "======================================"
fi

echo ""
echo "Trạng thái containers:"
docker compose ps
