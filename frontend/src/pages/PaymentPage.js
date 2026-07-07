import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { FaCheckCircle, FaTimesCircle, FaSpinner, FaArrowLeft, FaWallet, FaShieldAlt } from 'react-icons/fa';
import './PaymentPage.css';

const PaymentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const orderData = location.state?.orderData || null;
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);


  // ─────────────────────────────────────────────────────────────────────────────
  // Verify VNPay return — called once when VNPay redirects user back
  // ─────────────────────────────────────────────────────────────────────────────
  const verifyVNPayReturn = useCallback(async (queryParams) => {
    setPaymentResult({ type: 'checking', orderCode: queryParams.vnp_TxnRef });
    try {
      const token = localStorage.getItem('token');
      if (!token) { navigate('/login'); return; }

      const response = await axios.post(
        '/api/payments/vnpay/verify',
        queryParams,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      if (response.data.success) {
        setPaymentResult({ type: 'success', orderCode: queryParams.vnp_TxnRef });
        setTimeout(() => {
          navigate('/my-tickets', {
            state: { message: 'Thanh toán thành công! Vé của bạn đã được xác nhận.', type: 'success' }
          });
        }, 3000);
      } else {
        const code = response.data.responseCode;
        setPaymentResult({
          type: code === '24' ? 'cancelled' : 'error',
          message: response.data.msg || 'Thanh toán không thành công.'
        });
      }
    } catch (err) {
      if (err.response?.status === 410 || err.response?.data?.expired) {
        setPaymentResult({
          type: 'expired',
          message: err.response?.data?.msg || 'Đơn hàng đã hết hạn. Vui lòng đặt vé lại.'
        });
      } else {
        setPaymentResult({ type: 'error', message: err.response?.data?.msg || 'Lỗi xác nhận thanh toán.' });
      }
    }
  }, [navigate]);

  // Detect VNPay return URL params when page loads
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const vnpResponseCode = params.get('vnp_ResponseCode');
    const vnpTxnRef = params.get('vnp_TxnRef');

    if (vnpResponseCode !== null && vnpTxnRef) {
      const paramsObj = {};
      params.forEach((value, key) => { paramsObj[key] = value; });
      verifyVNPayReturn(paramsObj);
    }
  }, [location.search, verifyVNPayReturn]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Initiate VNPay payment
  // ─────────────────────────────────────────────────────────────────────────────

  const handleInitiatePayment = async (e) => {
    e.preventDefault();
    
    if (!orderData) {
      setError('Không có dữ liệu đơn hàng');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Build payload based on order type
      const paymentPayload = {};

      if (orderData.seat_ids && orderData.seat_ids.length > 0) {
        paymentPayload.seat_ids = orderData.seat_ids;
      } else {
        paymentPayload.seat_ids = [];
      }

      if (orderData.zone_id) {
        paymentPayload.zone_id = orderData.zone_id;
        paymentPayload.quantity = orderData.quantity || 0;
      }

      if (orderData.ticket_id) {
        paymentPayload.ticket_id = orderData.ticket_id;
        paymentPayload.ticket_quantity = orderData.quantity || 1;
      }

      // Truyền schedule_id nếu đây là sự kiện nhiều lịch diễn
      if (orderData.schedule_id) {
        paymentPayload.schedule_id = orderData.schedule_id;
      }

      const response = await axios.post(
        '/api/payments/init',
        paymentPayload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success && response.data.payment?.payUrl) {
        // Store order code and event ID for reference on return
        sessionStorage.setItem('lastOrderCode', response.data.order.code);
        if (orderData.event_id) sessionStorage.setItem('lastEventId', orderData.event_id);
        // Redirect browser to VNPay payment page
        window.location.href = response.data.payment.payUrl;
      } else {
        setError('Không thể tạo liên kết thanh toán. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('[Payment Init] Error:', err);
      const errMsg = err.response?.data?.msg || err.response?.data?.detail || 'Lỗi khởi tạo thanh toán. Vui lòng thử lại.';
      setError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────────
  const renderPaymentResult = () => {
    if (!paymentResult) return null;

    if (paymentResult.type === 'checking') {
      return (
        <div className="payment-result pending-result">
          <FaSpinner size={48} className="spinner-large" />
          <h2>Đang xác nhận giao dịch...</h2>
          <p>Vui lòng đợi trong giây lát.</p>
        </div>
      );
    }

    if (paymentResult.type === 'success') {
      return (
        <div className="payment-result success-result" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 0, padding: '48px 32px', textAlign: 'center',
        }}>
          {/* Animated checkmark */}
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: 'linear-gradient(135deg, #2CC275, #1da562)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
            boxShadow: '0 0 0 16px rgba(44,194,117,0.12), 0 8px 32px rgba(44,194,117,0.35)',
            animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <polyline points="10,26 20,36 38,16" stroke="white" strokeWidth="5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ strokeDasharray: 50, strokeDashoffset: 0, animation: 'drawCheck 0.4s ease 0.2s both' }} />
            </svg>
          </div>

          <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: '0 0 8px' }}>
            Thanh toán thành công!
          </h2>
          <p style={{ color: '#888', fontSize: 14, margin: '0 0 32px', lineHeight: 1.6 }}>
            Vé của bạn đã được xác nhận và gửi vào tài khoản.
          </p>

          {paymentResult.orderCode && (
            <div style={{
              background: 'rgba(44,194,117,0.08)', border: '1px solid rgba(44,194,117,0.2)',
              borderRadius: 12, padding: '14px 28px', marginBottom: 32,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ color: '#666', fontSize: 13 }}>Mã đơn hàng:</span>
              <span style={{ color: '#2CC275', fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>
                {paymentResult.orderCode}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/my-tickets')}
              style={{
                background: 'linear-gradient(135deg, #2CC275, #1da562)',
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '13px 28px', fontWeight: 700, fontSize: 15,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(44,194,117,0.35)',
              }}
            >
              Xem vé của tôi
            </button>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'transparent', color: '#666',
                border: '1px solid #333', borderRadius: 10,
                padding: '13px 28px', fontWeight: 600, fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Về trang chủ
            </button>
          </div>

          <p style={{ color: '#444', fontSize: 12, marginTop: 24 }}>
            Tự động chuyển đến trang vé sau 3 giây...
          </p>

          <style>{`
            @keyframes popIn {
              from { transform: scale(0); opacity: 0; }
              to   { transform: scale(1); opacity: 1; }
            }
            @keyframes drawCheck {
              from { stroke-dashoffset: 50; }
              to   { stroke-dashoffset: 0; }
            }
          `}</style>
        </div>
      );
    }

    if (paymentResult.type === 'pending') {
      return (
        <div className="payment-result pending-result">
          <FaSpinner size={48} className="spinner-large" />
          <h2>Đang chờ xác nhận</h2>
          <p>{paymentResult.message}</p>
          <button
            className="btn-primary"
            style={{ marginTop: 24 }}
            onClick={() => navigate('/my-tickets')}
          >
            Xem vé của tôi
          </button>
        </div>
      );
    }

    if (paymentResult.type === 'error' || paymentResult.type === 'cancelled') {
      const eventId = sessionStorage.getItem('lastEventId');
      return (
        <div className="payment-result error-result">
          <FaTimesCircle size={56} color="#ff4d4f" />
          <h2>{paymentResult.type === 'cancelled' ? 'Bạn đã hủy thanh toán' : 'Thanh toán không thành công'}</h2>
          <p>{paymentResult.message || 'Giao dịch thất bại. Vui lòng thử lại.'}</p>
          <div className="result-actions">
            <button className="btn-result-primary" onClick={() => navigate(eventId ? `/events/${eventId}` : '/')}>
              Chọn lại vé
            </button>
            <button className="btn-result-secondary" onClick={() => navigate('/')}>
              Trang chủ
            </button>
          </div>
        </div>
      );
    }

    if (paymentResult.type === 'expired') {
      const eventId = sessionStorage.getItem('lastEventId');
      return (
        <div className="payment-result error-result">
          <FaTimesCircle size={56} color="#fa8c16" />
          <h2 style={{ color: '#fa8c16' }}>Đơn hàng đã hết hạn</h2>
          <p style={{ color: '#ccc', maxWidth: 360, margin: '0 auto 24px' }}>
            {paymentResult.message}
          </p>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
            Vé đã được trả lại kho và có thể được người khác mua. Vui lòng đặt vé lại.
          </p>
          <div className="result-actions">
            <button className="btn-result-primary" onClick={() => navigate(eventId ? `/events/${eventId}` : '/')}>
              Đặt vé lại
            </button>
          </div>
        </div>
      );
    }

    if (paymentResult.type === 'cancelled') {
      const eventId = sessionStorage.getItem('lastEventId');
      return (
        <div className="payment-result error-result">
          <FaTimesCircle size={56} color="#faad14" />
          <h2 style={{ color: '#faad14' }}>Bạn đã huỷ giao dịch</h2>
          <p style={{ color: '#ccc', marginBottom: 24 }}>
            {paymentResult.message || 'Giao dịch đã bị huỷ. Vé của bạn chưa được đặt.'}
          </p>
          <div className="result-actions">
            <button className="btn-result-primary" onClick={() => navigate(eventId ? `/events/${eventId}` : '/')}>
              Chọn lại vé
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // If URL has vnp_ResponseCode, we're returning from VNPay
  // ─────────────────────────────────────────────────────────────────────────────
  const isReturningFromVNPay = location.search.includes('vnp_ResponseCode');

  if (isReturningFromVNPay || paymentResult) {
    return (
      <div className="payment-page">
        <div className="payment-container">
          {renderPaymentResult()}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Checkout form
  // ─────────────────────────────────────────────────────────────────────────────
  const PLATFORM_FEE_RATE = 0.035;
  const baseAmount = orderData?.total_amount || 0;
  const serviceFee  = Math.round(baseAmount * PLATFORM_FEE_RATE);
  const displayTotal = baseAmount + serviceFee;

  return (
    <div className="payment-page">
      <div className="payment-container">
        <div className="payment-header">
          <button 
            className="btn-back"
            onClick={() => navigate(-1)}
            disabled={submitting}
          >
            <FaArrowLeft /> Quay lại
          </button>
          <h1>Thanh Toán</h1>
        </div>

        {error && (
          <div className="alert alert-error">
            <FaTimesCircle /> {error}
          </div>
        )}

        {orderData ? (
          <div className="payment-content">
            {/* Event info (if provided) */}
            {orderData.event_title && (
              <div className="event-title-row">
                <span className="event-label">Sự kiện:</span>
                <span className="event-value">{orderData.event_title}</span>
              </div>
            )}

            {/* Order Summary */}
            <div className="order-summary">
              <h2>Chi Tiết Đơn Hàng</h2>

              {orderData.seat_ids && orderData.seat_ids.length > 0 && (
                <div className="summary-item">
                  <span className="label">Số ghế:</span>
                  <span className="value">{orderData.seat_ids.length} ghế</span>
                </div>
              )}

              {orderData.zone_id && (
                <div className="summary-item">
                  <span className="label">Khu vực:</span>
                  <span className="value">{orderData.quantity} vé</span>
                </div>
              )}

              {orderData.ticket_type && (
                <div className="summary-item">
                  <span className="label">Loại vé:</span>
                  <span className="value">{orderData.ticket_type} × {orderData.quantity}</span>
                </div>
              )}

              <div className="summary-item">
                <span className="label">Giá gốc:</span>
                <span className="value">
                  {baseAmount.toLocaleString('vi-VN')} đ
                </span>
              </div>

              <div className="summary-item" style={{ color: '#aaa' }}>
                <span className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Phí dịch vụ
                  <span style={{
                    background: 'rgba(44,194,117,0.12)',
                    color: '#2CC275',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 4
                  }}>3.5%</span>
                </span>
                <span className="value" style={{ color: '#aaa' }}>
                  +{serviceFee.toLocaleString('vi-VN')} đ
                </span>
              </div>

              <div className="summary-divider" />

              <div className="summary-item total">
                <span className="label">Tổng Cộng:</span>
                <span className="value">
                  {displayTotal.toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="payment-methods">
              <h2>Phương Thức Thanh Toán</h2>
              <div className="method-option">
                <div className="method-badge">
                  <span className="badge-icon">
                    <FaWallet style={{ color: '#2CC275', fontSize: 32 }} />
                  </span>
                  <div className="badge-info">
                    <div className="badge-name">VNPay</div>
                    <div className="badge-desc">Thanh toán qua VNPay - ATM, thẻ tín dụng, QR Code</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security note */}
            <div className="payment-info">
              <p>
                <FaShieldAlt style={{ marginRight: 6, color: '#2CC275' }} />
                Bằng cách nhấn "Thanh toán ngay", bạn sẽ được chuyển đến trang
                <strong>VNPay</strong> để hoàn tất giao dịch một cách an toàn.
              </p>
            </div>

            {/* Pay Button */}
            <form onSubmit={handleInitiatePayment} className="payment-form">
              <button
                type="submit"
                className="btn-pay"
                disabled={submitting || !orderData}
              >
                {submitting ? (
                  <>
                    <FaSpinner className="spinner-icon" /> Đang xử lý...
                  </>
                ) : (
                  <>
                    Thanh Toán Ngay
                    <span className="amount">
                      {displayTotal.toLocaleString('vi-VN')} đ
                    </span>
                  </>
                )}
              </button>
            </form>

            <div className="payment-cancel">
              <p>Bạn có thể quay lại và thay đổi lựa chọn bất kỳ lúc nào.</p>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p>Không có dữ liệu đơn hàng. Vui lòng chọn vé trước.</p>
            <button 
              className="btn-primary"
              onClick={() => navigate('/')}
            >
              <FaArrowLeft /> Về trang chủ
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentPage;
