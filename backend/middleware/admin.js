module.exports = function (req, res, next) {
  // req.user đã được tạo ra từ middleware 'auth' trước đó
  // Kiểm tra role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ msg: "Truy cập bị từ chối! Bạn không phải là Admin." });
  }
  next();
};

