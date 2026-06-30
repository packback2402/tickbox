const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Thư mục uploads
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Cấu hình multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (ALLOWED.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc GIF.'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// POST /api/upload/image
router.post('/upload/image', auth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ msg: 'Ảnh không được vượt quá 5MB.' });
      }
      return res.status(400).json({ msg: err.message || 'Upload thất bại.' });
    }
    if (!req.file) {
      return res.status(400).json({ msg: 'Vui lòng chọn file ảnh.' });
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });
});

// POST /api/auth/register
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userExist = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ msg: "Email này đã được đăng ký!" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    // Mặc định luôn là customer
    const newUser = await db.query(
      "INSERT INTO users (email, password, role) VALUES ($1, $2, 'customer') RETURNING *",
      [email, hashedPassword]
    );
    res.status(201).json({ msg: "Đăng ký thành công!", user: newUser.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      return res.status(401).json({ msg: "Email không tồn tại!" });
    }
    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) {
      return res.status(401).json({ msg: "Mật khẩu không đúng!" });
    }
    const token = jwt.sign(
      { id: user.rows[0].id, role: user.rows[0].role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Nếu là organizer, lấy thêm thông tin tổ chức
    let orgProfile = null;
    if (user.rows[0].role === 'organizer') {
      const profileRes = await db.query(
        "SELECT org_name, phone, description FROM organizer_profiles WHERE user_id = $1",
        [user.rows[0].id]
      );
      if (profileRes.rows.length > 0) {
        orgProfile = profileRes.rows[0];
      }
    }

    res.json({
      msg: "Đăng nhập thành công!",
      token: token,
      user: {
        id: user.rows[0].id,
        email: user.rows[0].email,
        role: user.rows[0].role,
        org_name: orgProfile ? orgProfile.org_name : null,
        full_name: user.rows[0].full_name || null,
        avatar_url: user.rows[0].avatar_url || null,
        phone: user.rows[0].phone || null,
        date_of_birth: user.rows[0].date_of_birth || null,
        gender: user.rows[0].gender || null,
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/user/profile
router.get('/user/profile', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, role, full_name, phone, avatar_url, date_of_birth, gender
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy người dùng" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// PUT /api/user/profile
router.put('/user/profile', auth, async (req, res) => {
  try {
    const { full_name, phone, avatar_url, date_of_birth, gender } = req.body;
    const result = await db.query(
      `UPDATE users
       SET full_name = $1, phone = $2, avatar_url = $3,
           date_of_birth = $4, gender = $5
       WHERE id = $6
       RETURNING id, email, role, full_name, phone, avatar_url, date_of_birth, gender`,
      [full_name || null, phone || null, avatar_url || null, date_of_birth || null, gender || null, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy người dùng" });
    }
    res.json({ msg: "Cập nhật thành công!", user: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

module.exports = router;
