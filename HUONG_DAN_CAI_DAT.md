# HƯỚNG DẪN CÀI ĐẶT HỆ THỐNG TITICKET

## Giới thiệu

TiTicket là hệ thống bán vé sự kiện trực tuyến gồm 4 thành phần chính:

| Thành phần | Công nghệ | Mô tả |
|---|---|---|
| Frontend | React 18 | Giao diện người dùng |
| Backend | Node.js + Express | REST API |
| Database | PostgreSQL 16 | Lưu trữ dữ liệu |
| Reverse Proxy | Nginx | HTTPS, load balancing |

Hệ thống được đóng gói bằng **Docker Compose**, hỗ trợ hai cách chạy:
- **Cách 1 — Chạy local (phát triển):** Không cần Docker, chạy trực tiếp bằng Node.js
- **Cách 2 — Deploy lên VPS (production):** Dùng Docker Compose + SSL tự động

---

## YÊU CẦU HỆ THỐNG

### Cách 1 — Chạy local

| Phần mềm | Phiên bản tối thiểu | Kiểm tra |
|---|---|---|
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| PostgreSQL | 14+ | `psql --version` |

### Cách 2 — Deploy VPS

| Phần mềm | Phiên bản tối thiểu | Kiểm tra |
|---|---|---|
| Docker | 24+ | `docker --version` |
| Docker Compose | v2 | `docker compose version` |
| Hệ điều hành | Ubuntu 20.04+ | — |
| RAM | tối thiểu 2 GB | — |
| Domain | có DNS trỏ về IP VPS | — |

---

## CÁCH 1: CHẠY LOCAL (Phát triển)

### Bước 1 — Chuẩn bị cơ sở dữ liệu

1. Đảm bảo PostgreSQL đã chạy trên máy.
2. Tạo database:

```sql
psql -U postgres
CREATE DATABASE titicket_db;
CREATE USER titicket_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE titicket_db TO titicket_user;
\q
```

3. Khởi tạo schema và dữ liệu mẫu:

```bash
psql -U titicket_user -d titicket_db -f sql/init.sql
```

### Bước 2 — Cấu hình Backend

```bash
cd backend
cp .env .env.backup   # Sao lưu nếu cần
```

Tạo (hoặc chỉnh sửa) file `backend/.env` với nội dung:

```env
# Database
DB_USER=titicket_user
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=titicket_db

# JWT (tạo bằng: openssl rand -base64 64)
JWT_SECRET=your_jwt_secret_here

# VNPay Sandbox (dùng thông tin sandbox mặc định để test)
VNPAY_TMN_CODE=OZ9V39U6
VNPAY_SECRET_KEY=0V6J5BMPY3GR54P5HF4G9VJLV6UX508P
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3000/payment

# Thanh toán
PAYMENT_TIMEOUT=900
COMMISSION_RATE=3.5

# Email (Gmail SMTP — cần bật "App Password" trong Google Account)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password

# URL Frontend
FRONTEND_URL=http://localhost:3000

# E-Ticket (tạo bằng: openssl rand -base64 32)
TICKET_SECRET_KEY=your_ticket_secret_here
```

### Bước 3 — Khởi động Backend

```bash
cd backend
npm install
npm start
```

Backend sẽ chạy tại: `http://localhost:5001`

### Bước 4 — Khởi động Frontend

Mở terminal mới:

```bash
cd frontend
npm install
npm start
```

Frontend sẽ chạy tại: `http://localhost:3000`

### Bước 5 — Đăng nhập thử

Truy cập `http://localhost:3000` và đăng nhập bằng tài khoản admin mặc định:

| Thông tin | Giá trị |
|---|---|
| Email | `admin@titicket.com` |
| Mật khẩu | `123456` |

> **Lưu ý:** Đổi mật khẩu admin sau khi đăng nhập lần đầu.

---

## CÁCH 2: DEPLOY LÊN VPS (Production)

### Bước 1 — Chuẩn bị VPS

Đăng nhập vào VPS và cài Docker (nếu chưa có):

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logout và login lại để áp dụng
```

### Bước 2 — Tải mã nguồn lên VPS

```bash
# Cách A: dùng scp từ máy local
scp -r "Bản sao TiTicket (deploy)" user@your-vps-ip:/home/user/titicket

# Cách B: nếu có git repo
git clone <repository-url> titicket
cd titicket
```

### Bước 3 — Cấu hình biến môi trường

```bash
cd titicket
cp .env.production .env
nano .env   # Hoặc dùng vim, vi
```

Điền đầy đủ các giá trị sau (thay thế các giá trị `CHANGE_TO_...`):

```env
# Database — đặt mật khẩu mạnh
DB_USER=titicket_user
DB_PASSWORD=CHANGE_TO_STRONG_PASSWORD
DB_DATABASE=titicket_db

# JWT — tạo bằng lệnh: openssl rand -base64 64
JWT_SECRET=CHANGE_TO_STRONG_RANDOM_SECRET

# VNPay — thay bằng thông tin tài khoản thật khi live
VNPAY_TMN_CODE=OZ9V39U6
VNPAY_SECRET_KEY=0V6J5BMPY3GR54P5HF4G9VJLV6UX508P
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://your-domain.com/payment

# Email
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password

# URL production
FRONTEND_URL=https://your-domain.com

# E-Ticket — tạo bằng lệnh: openssl rand -base64 32
TICKET_SECRET_KEY=CHANGE_TO_STRONG_RANDOM_SECRET
```

> **Quan trọng:** Đảm bảo DNS của `your-domain.com` đã trỏ về IP VPS trước khi chạy bước tiếp theo (để cấp SSL thành công).

### Bước 4 — Chạy script deploy tự động

```bash
chmod +x deploy.sh
bash deploy.sh your-domain.com
```

Script sẽ tự động thực hiện:
1. Kiểm tra Docker
2. Xác nhận file `.env` hợp lệ
3. Cập nhật cấu hình Nginx với domain thật
4. Cấp chứng chỉ SSL miễn phí (Let's Encrypt)
5. Build tất cả Docker image
6. Khởi động toàn bộ hệ thống
7. Kiểm tra health check

Khi hoàn tất, hệ thống chạy tại: `https://your-domain.com`

---

## CẤU TRÚC THƯ MỤC

```
TiTicket/
├── frontend/               # Mã nguồn React
│   ├── src/
│   │   ├── pages/          # Các trang: Home, Admin, Organizer...
│   │   ├── components/     # Component dùng chung
│   │   └── index.js        # Entry point
│   ├── public/
│   └── package.json
│
├── backend/                # Mã nguồn Node.js API
│   ├── index.js            # Entry point — khởi động server, mount routers
│   ├── config.js           # Cấu hình phí nền tảng (PLATFORM_FEE_RATE)
│   ├── db.js               # Kết nối PostgreSQL
│   ├── middleware/         # auth, admin, adminOrOrganizer guards
│   ├── routes/             # Router modules theo domain:
│   │   ├── auth.js         #   Đăng ký, đăng nhập, hồ sơ
│   │   ├── events.js       #   Sự kiện, lịch diễn
│   │   ├── tickets.js      #   Loại vé
│   │   ├── orders.js       #   Đơn hàng
│   │   ├── seatmap.js      #   Sơ đồ chỗ ngồi, giữ ghế
│   │   ├── queue.js        #   Hàng chờ mua vé
│   │   ├── admin.js        #   Quản trị viên
│   │   ├── organizer.js    #   Nhà tổ chức
│   │   ├── categories.js   #   Danh mục sự kiện
│   │   └── payments.js     #   Thanh toán VNPay / QR
│   ├── jobs/               # expireOrders.js (tự động hủy đơn hết hạn)
│   ├── utils/              # ticketService, vnpayPayment
│   ├── uploads/            # Ảnh upload (được persist qua Docker volume)
│   └── package.json
│
├── sql/
│   ├── init.sql            # Schema + seed data — chạy tự động khi DB khởi động
│   └── migration_*.sql     # Các migration (tham khảo)
│
├── nginx/
│   └── nginx.conf          # Cấu hình reverse proxy + HTTPS
│
├── docker-compose.yml      # Orchestration 4 container
├── deploy.sh               # Script deploy tự động
├── .env.production         # Mẫu biến môi trường
└── HUONG_DAN_CAI_DAT.md    # File này
```

---

## CÁC LỆNH QUẢN LÝ (sau khi deploy)

```bash
# Xem log realtime
docker compose logs -f

# Xem log của một service cụ thể
docker compose logs -f backend
docker compose logs -f frontend

# Kiểm tra trạng thái các container
docker compose ps

# Restart một service
docker compose restart backend

# Dừng toàn bộ hệ thống
docker compose down

# Dừng và xóa toàn bộ dữ liệu (cẩn thận!)
docker compose down -v

# Cập nhật code và khởi động lại
docker compose build --no-cache
docker compose up -d
```

---

## TÀI KHOẢN MẶC ĐỊNH

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@titicket.com` | `123456` |

> Sau khi cài đặt, đăng nhập vào trang Admin để tạo thêm tài khoản và duyệt sự kiện.

---

## TÍCH HỢP THANH TOÁN VNPAY

Hệ thống sử dụng **VNPay Sandbox** theo mặc định. Để test thanh toán:

1. Chọn thanh toán VNPay khi mua vé
2. Dùng thẻ test của VNPay:
   - **Số thẻ:** `9704198526191432198`
   - **Tên chủ thẻ:** `NGUYEN VAN A`
   - **Ngày phát hành:** `07/15`
   - **OTP:** `123456`

Để chuyển sang **VNPay Production**, đăng ký tài khoản tại [https://vnpay.vn](https://vnpay.vn) và cập nhật các biến `VNPAY_TMN_CODE`, `VNPAY_SECRET_KEY`, `VNPAY_URL` trong file `.env`.

---

## XỬ LÝ SỰ CỐ THƯỜNG GẶP

**Backend không kết nối được database:**
```bash
docker compose logs db          # Xem log PostgreSQL
docker compose restart backend  # Thử restart backend
```

**SSL không cấp được:**
- Kiểm tra DNS đã trỏ về IP VPS chưa: `nslookup your-domain.com`
- Đảm bảo port 80 đang mở trên firewall VPS

**Frontend hiển thị lỗi API:**
- Kiểm tra backend đang chạy: `docker compose ps`
- Kiểm tra biến `FRONTEND_URL` và `VNPAY_RETURN_URL` trong `.env` có đúng domain không

**Xem logs chi tiết:**
```bash
docker compose logs --tail=100 backend
```
