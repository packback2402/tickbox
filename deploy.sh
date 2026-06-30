#!/bin/bash
# deploy.sh — Script deploy TiTicket lên VPS
# Chạy trên VPS sau khi clone repo

set -e  # Dừng nếu có lỗi

DOMAIN="${1:-your-domain.com}"

echo "======================================"
echo "  TiTicket Deploy Script"
echo "  Domain: $DOMAIN"
echo "======================================"

# Bước 1: Kiểm tra Docker
echo ""
echo "[1/7] Kiểm tra Docker..."
if ! command -v docker &> /dev/null; then
    echo "Docker chưa cài. Đang cài..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "Docker đã cài. Vui lòng logout/login lại rồi chạy lại script."
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "Docker Compose chưa cài. Đang cài..."
    sudo apt-get update && sudo apt-get install -y docker-compose-plugin
fi
echo "Docker $(docker --version)"

# Bước 2: Kiểm tra file .env
echo ""
echo "[2/7] Kiểm tra file .env..."
if [ ! -f ".env" ]; then
    echo " File .env không tồn tại!"
    echo "   Hãy sao chép .env.production thành .env và điền thông tin:"
    echo "   cp .env.production .env && nano .env"
    exit 1
fi

# Kiểm tra các biến bắt buộc
required_vars=("DB_USER" "DB_PASSWORD" "DB_DATABASE" "JWT_SECRET" "TICKET_SECRET_KEY" "FRONTEND_URL")
for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env || grep -q "^${var}=CHANGE_TO" .env; then
        echo " Biến ${var} trong .env chưa được cấu hình!"
        exit 1
    fi
done
echo " File .env hợp lệ"

# Bước 3: Cập nhật nginx.conf với domain thật
echo ""
echo "[3/7] Cập nhật Nginx config với domain: $DOMAIN..."
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" nginx/nginx.conf
echo " Nginx config đã cập nhật"

# Bước 4: Lấy SSL certificate từ Let's Encrypt
echo ""
echo "[4/7] Cấp chứng chỉ SSL (Let's Encrypt)..."

# Khởi động Nginx tạm thời với HTTP để xác thực domain
mkdir -p nginx/certbot/conf nginx/certbot/www

# Dùng nginx config HTTP-only để certbot có thể xác thực
cat > /tmp/nginx_certbot.conf << EOF
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name $DOMAIN;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / { return 200 'OK'; }
    }
}
EOF

docker run -d --rm --name nginx_temp \
    -p 80:80 \
    -v /tmp/nginx_certbot.conf:/etc/nginx/nginx.conf:ro \
    -v $(pwd)/nginx/certbot/www:/var/www/certbot \
    nginx:alpine

sleep 3

# Lấy chứng chỉ
docker run --rm \
    -v $(pwd)/nginx/certbot/conf:/etc/letsencrypt \
    -v $(pwd)/nginx/certbot/www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email admin@$DOMAIN \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

docker stop nginx_temp 2>/dev/null || true
echo "SSL certificate đã cấp"

# Bước 5: Build và khởi động tất cả container
echo ""
echo "[5/7] Build Docker images..."
docker compose build --no-cache

echo ""
echo "[6/7] Khởi động toàn bộ hệ thống..."
docker compose up -d

# Bước 6: Chờ DB sẵn sàng
echo ""
echo "[7/7] Kiểm tra hệ thống..."
sleep 10

# Health check
if curl -sf http://localhost/api/health > /dev/null; then
    echo ""
    echo "======================================"
    echo "  DEPLOY THÀNH CÔNG!"
    echo "  Website: https://$DOMAIN"
    echo "  Admin: https://$DOMAIN (đăng nhập với admin@titicket.com)"
    echo "======================================"
else
    echo ""
    echo "  Hệ thống đang khởi động, kiểm tra logs:"
    echo "   docker compose logs -f"
fi

echo ""
echo "Các lệnh hữu ích:"
echo "  docker compose logs -f          # Xem logs"
echo "  docker compose restart backend  # Restart backend"
echo "  docker compose down             # Dừng tất cả"
echo "  docker compose ps               # Kiểm tra trạng thái"
