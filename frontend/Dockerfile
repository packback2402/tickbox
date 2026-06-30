# =============================================
# Frontend Dockerfile — React + Nginx
# Multi-stage build như mô tả trong đồ án
# =============================================

# Stage 1: Build React app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Cài đầy đủ dependencies (--legacy-peer-deps để bỏ qua xung đột qrcode.react với React 18)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build production bundle
# REACT_APP_API_URL sẽ được set qua build arg
# REACT_APP_API_URL="" → axios baseURL rỗng → dùng relative URL
# Routes trong code đã có /api prefix: api.get('/api/events') → /api/events ✓
# Nếu set /api thì sẽ thành /api/api/events ✗
ARG REACT_APP_API_URL=
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Giới hạn RAM Node.js khi build (tránh OOM trên VPS 2GB)
ENV NODE_OPTIONS=--max-old-space-size=1024
RUN npm run build

# =============================================
# Stage 2: Serve bằng Nginx nhẹ (alpine)
# =============================================
FROM nginx:alpine AS production

# Xóa config mặc định của nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx config tùy chỉnh
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy build output từ stage 1
COPY --from=builder /app/build /usr/share/nginx/html

# Expose cổng 80 (Nginx sẽ serve static files)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
