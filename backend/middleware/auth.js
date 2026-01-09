const jwt = require('jsonwebtoken');

// Hàm này sẽ đứng giữa request của người dùng và API
const auth = (req, res, next) => {
  try {
    // 1. Lấy token từ header (x-auth-token)
    const token = req.header('x-auth-token');

    // 2. Nếu không có token -> Chặn lại
    if (!token) {
      return res.status(401).json({ msg: "Không có token, từ chối truy cập!" });
    }

    // 3. Nếu có -> Kiểm tra xem token có hợp lệ không (dùng chìa khóa bí mật)
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    
    // 4. Nếu hợp lệ -> Gán thông tin user vào request và cho đi tiếp
    req.user = verified;
    next();
  } catch (err) {
    res.status(500).json({ msg: "Token không hợp lệ!" });
  }
};

module.exports = auth;