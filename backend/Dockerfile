# =============================================
# Backend Dockerfile — Node.js + Express
# =============================================

FROM node:20-alpine AS production

# Tạo thư mục app
WORKDIR /app

# Copy package files trước (tận dụng Docker cache layer)
COPY package.json package-lock.json ./

# Cài dependencies production only
RUN npm ci --omit=dev

# Copy toàn bộ source code
COPY . .

# Tạo thư mục uploads (nếu chưa có)
RUN mkdir -p uploads

# Expose cổng backend
EXPOSE 5001

# Khởi động server
CMD ["node", "index.js"]
