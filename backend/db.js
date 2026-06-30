const { Pool } = require("pg");

const pool = new Pool({
  // Sử dụng các biến rời rạc đã khai báo trong .env
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  
  // Đã xóa phần cấu hình SSL để chạy mượt mà trên localhost
  
  max: 5,                 // số connection tối đa
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

pool.on("connect", () => {
  console.log("[DB] Connected to PostgreSQL (Local)");
});

pool.on("error", (err) => {
  console.error("[DB] [FATAL] Unexpected PG error", err);
  process.exit(1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};