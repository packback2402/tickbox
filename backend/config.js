// Cấu hình phí nền tảng — dùng chung toàn backend
const PLATFORM_FEE_RATE = 0.035; // 3.5% phí nền tảng
const ORGANIZER_SHARE   = 1 - PLATFORM_FEE_RATE; // 96.5% cho nhà tổ chức

module.exports = { PLATFORM_FEE_RATE, ORGANIZER_SHARE };
