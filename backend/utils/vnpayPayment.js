/**
 * VNPay Payment Utility — powered by official `vnpay` npm library (v2.5.0)
 *
 * Sandbox Credentials:
 *   TmnCode  : DEMOV210
 *   HashSecret: RAOEXHYVSDDIILLHHVXQOQLFLPMCLPHZ
 *
 * Test Card (NCB Bank):
 *   Number   : 9704198526191432198
 *   Name     : NGUYEN VAN A
 *   Expiry   : 07/15
 *   OTP      : 123456
 *
 * Flow:
 *   1. Backend calls buildPaymentUrl() → returns URL
 *   2. Frontend redirects user to VNPay
 *   3. VNPay redirects back with params on returnUrl
 *   4. Frontend sends params to POST /api/payments/vnpay/verify
 *   5. Backend calls verifyReturnParams() → updates order
 */

const { VNPay, ignoreLogger, ProductCode, VnpLocale, dateFormat } = require('vnpay');

// ─── Singleton instance ────────────────────────────────────────────────────
const vnpayInstance = new VNPay({
  tmnCode:       process.env.VNPAY_TMN_CODE   || 'DEMOV210',
  secureSecret:  process.env.VNPAY_SECRET_KEY || 'RAOEXHYVSDDIILLHHVXQOQLFLPMCLPHZ',
  vnpayHost:     'https://sandbox.vnpayment.vn',
  testMode:      false,
  hashAlgorithm: 'SHA512',
  loggerFn:      ignoreLogger,
});

const RETURN_URL = process.env.VNPAY_RETURN_URL || 'http://localhost:3000/payment';

// ─── Exported config (for reference in other modules) ─────────────────────
const VNPAY_CONFIG = {
  tmnCode:   process.env.VNPAY_TMN_CODE   || 'DEMOV210',
  secretKey: process.env.VNPAY_SECRET_KEY || 'RAOEXHYVSDDIILLHHVXQOQLFLPMCLPHZ',
  url:       'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: RETURN_URL,
};

/**
 * Build VNPay payment URL
 * @param {Object} options
 * @param {string} options.orderId     - Unique order reference
 * @param {number} options.amount      - Amount in VND
 * @param {string} options.orderInfo   - Order description
 * @param {string} [options.ipAddr]    - Client IP address
 * @param {string} [options.bankCode]  - Optional bank code
 * @param {string} [options.locale]    - 'vn' or 'en'
 * @returns {string} Full payment URL
 */
function createPaymentUrl({ orderId, amount, orderInfo, ipAddr = '127.0.0.1', bankCode = '', locale = 'vn' }) {
  // Sanitize orderInfo — ASCII only, spaces → underscore
  const safeOrderInfo = (orderInfo || 'TiTicket')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')        // strip diacritics
    .replace(/[^a-zA-Z0-9\s\-_.]/g, ' ')   // remove special chars
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 255) || 'TiTicket Payment';

  // VNPay yêu cầu CreateDate/ExpireDate theo giờ Việt Nam (ICT = UTC+7)
  // Server VPS chạy UTC → cần cộng thêm 7h trước khi format
  const toICT = (date) => new Date(date.getTime() + 7 * 60 * 60 * 1000);

  const now = new Date();
  const expireDate = new Date(now.getTime() + 15 * 60 * 1000); // 15 phút

  const paymentUrl = vnpayInstance.buildPaymentUrl({
    vnp_Amount:     amount,
    vnp_IpAddr:     ipAddr,
    vnp_ReturnUrl:  RETURN_URL,
    vnp_TxnRef:     orderId,
    vnp_OrderInfo:  safeOrderInfo,
    vnp_OrderType:  ProductCode.Other,
    vnp_Locale:     locale === 'en' ? VnpLocale.EN : VnpLocale.VN,
    vnp_CreateDate: dateFormat(toICT(now)),
    vnp_ExpireDate: dateFormat(toICT(expireDate)),
    ...(bankCode ? { vnp_BankCode: bankCode } : {}),
  });

  console.log('[VNPay] URL built for order:', orderId, '| Amount:', amount, 'VND');
  return paymentUrl;
}

/**
 * Verify VNPay return URL params (called from backend after redirect)
 * @param {Object} query - All query params from VNPay return URL
 * @returns {{ isValid, isSuccess, orderCode, amount, responseCode, message }}
 */
function verifyReturnParams(query) {
  try {
    const result = vnpayInstance.verifyReturnUrl(query);

    const responseMessages = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ.',
      '09': 'Thẻ/Tài khoản chưa đăng ký InternetBanking.',
      '10': 'Xác thực thông tin thẻ không đúng quá 3 lần.',
      '11': 'Đã hết hạn chờ thanh toán. Vui lòng thực hiện lại.',
      '12': 'Thẻ/Tài khoản bị khóa.',
      '13': 'Nhập sai mật khẩu OTP.',
      '24': 'Quý khách đã hủy giao dịch.',
      '51': 'Tài khoản không đủ số dư.',
      '65': 'Tài khoản vượt quá hạn mức giao dịch trong ngày.',
      '75': 'Ngân hàng đang bảo trì.',
      '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định.',
      '99': 'Lỗi không xác định.',
    };

    const responseCode = query.vnp_ResponseCode || query.vnp_TransactionStatus;

    return {
      isValid: result.isVerified,
      isSuccess: result.isSuccess,
      orderCode: query.vnp_TxnRef,
      amount: parseInt(query.vnp_Amount || 0) / 100,
      transactionId: query.vnp_TransactionNo,
      bankCode: query.vnp_BankCode,
      responseCode,
      message: responseMessages[responseCode] || `Lỗi không xác định (${responseCode})`,
    };
  } catch (err) {
    console.error('[VNPay] verifyReturnParams error:', err.message);
    return { isValid: false, isSuccess: false, message: 'Lỗi xác thực chữ ký.' };
  }
}

/**
 * Verify VNPay IPN (server-to-server notification)
 * @param {Object} query - Query params from VNPay IPN call
 * @returns {{ isValid, isSuccess, orderCode, amount, responseCode }}
 */
function verifyIpnParams(query) {
  try {
    const result = vnpayInstance.verifyIpnCall(query);
    return {
      isValid: result.isVerified,
      isSuccess: result.isSuccess,
      orderCode: query.vnp_TxnRef,
      amount: parseInt(query.vnp_Amount || 0) / 100,
      responseCode: query.vnp_ResponseCode,
    };
  } catch (err) {
    console.error('[VNPay] verifyIpnParams error:', err.message);
    return { isValid: false, isSuccess: false };
  }
}

/**
 * Generate unique order ID compatible with VNPay (max 64 chars)
 */
function generateOrderId(prefix = 'TB') {
  return `${prefix}${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
}

module.exports = {
  VNPAY_CONFIG,
  createPaymentUrl,
  verifyReturnParams,
  verifyIpnParams,
  generateOrderId,
};
