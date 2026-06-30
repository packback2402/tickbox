module.exports = (req, res, next) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "organizer")) {
    return res.status(403).json({
      msg: "Truy cập bị từ chối! Chỉ Admin hoặc Nhà tổ chức mới được phép."
    });
  }
  next();
};
