import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode.react';
import { FaDownload, FaShare, FaCheck, FaClock, FaMapMarkerAlt, FaCalendarAlt, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';
import axios from 'axios';
import html2pdf from 'html2pdf.js/dist/html2pdf.min.js';
import './ETicket.css';

const ETicket = ({ orderItemId, subIndex = 1 }) => {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const qrRef = useRef(null);
  const ticketRef = useRef(null);

  useEffect(() => {
    fetchTicketDetails();
  }, [orderItemId, subIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTicketDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/payments/eticket/${orderItemId}?sub=${subIndex}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setTicket(response.data.ticket);
        setError('');
      } else {
        setError(response.data.msg || 'Không thể tải vé');
      }
    } catch (err) {
      console.error('Error fetching ticket:', err);
      setError(err.response?.data?.msg || 'Lỗi tải thông tin vé');
    } finally {
      setLoading(false);
    }
  };

  const downloadTicketPDF = () => {
    if (!ticketRef.current) return;

    const element = ticketRef.current;
    const opt = {
      margin: 10,
      filename: `ticket-${ticket.orderCode}.pdf`,
      image: { type: 'png', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };

    html2pdf().set(opt).from(element).save();
  };

  const downloadQRCode = () => {
    if (!qrRef.current) return;

    const url = qrRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-code-${ticket.orderCode}.png`;
    link.click();
  };

  const shareTicket = async () => {
    const shareText = `Tôi đã mua vé thành công cho sự kiện ${ticket.eventTitle}. Ngày: ${ticket.eventDate} tại ${ticket.eventVenue}. Mã đơn hàng: ${ticket.orderCode}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'E-Ticket',
          text: shareText,
        });
      } catch (err) {
        console.log('Share cancelled or error:', err);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareText);
      alert('Đã sao chép thông tin vé');
    }
  };

  const copyTicketCode = () => {
    navigator.clipboard.writeText(ticket.orderCode);
    alert('Đã sao chép mã vé');
  };

  if (loading) {
    return (
      <div className="eticket-loading">
        <div className="spinner"></div>
        <p>Đang tải vé...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="eticket-error">
        <p><FaExclamationTriangle /> {error}</p>
        <button onClick={fetchTicketDetails}>Tải lại</button>
      </div>
    );
  }

  if (!ticket) {
    return <div className="eticket-error"><p>Không tìm thấy vé</p></div>;
  }

  const isUsed = ticket.status === 'used';
  // Use raw ISO date from backend for reliable comparison (not locale-formatted string)
  const isExpired = ticket.expiryDateRaw
    ? new Date(ticket.expiryDateRaw) < new Date()
    : false;

  return (
    <div className="eticket-container">
      {/* Ticket Reference */}
      <div className="ticket-header">
        <div className="ticket-status">
          {isUsed && (
            <span className="status-badge status-used">
              <FaCheck /> ĐÃ SỬ DỤNG
            </span>
          )}
          {isExpired && !isUsed && (
            <span className="status-badge status-expired">
              <FaClock /> ĐÃ HẾT HẠN
            </span>
          )}
          {!isUsed && !isExpired && (
            <span className="status-badge status-active">
              <FaCheck /> CÒN HIỆU LỰC
            </span>
          )}
        </div>
        <button className="ticket-copy-btn" onClick={copyTicketCode} title="Sao chép mã vé">
          Mã: {ticket.orderCode}
        </button>
      </div>

      {/* Main Ticket Display */}
      <div className="eticket-main" ref={ticketRef}>
        {/* Ticket number label for multi-quantity orders */}
        {ticket.totalQuantity > 1 && (
          <div style={{
            textAlign: 'center',
            padding: '8px 16px',
            background: 'rgba(44,194,117,0.12)',
            border: '1px solid rgba(44,194,117,0.3)',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#2CC275'
          }}>
            Vé {ticket.subIndex} / {ticket.totalQuantity}
          </div>
        )}
        {/* Event Information */}
        <div className="ticket-event-info">
          <h2 className="event-title">{ticket.eventTitle}</h2>

          <div className="ticket-details">
            <div className="detail-item">
              <FaCalendarAlt className="detail-icon" />
              <div className="detail-text">
                <span className="detail-label">Ngày giờ</span>
                <span className="detail-value">{ticket.eventDateTime}</span>
              </div>
            </div>

            <div className="detail-item">
              <FaMapMarkerAlt className="detail-icon" />
              <div className="detail-text">
                <span className="detail-label">Địa điểm</span>
                <span className="detail-value">{ticket.eventVenue}</span>
              </div>
            </div>

            <div className="detail-item">
              <span className="detail-label">Giá vé</span>
              <span className="detail-value price">
                {parseFloat(ticket.price).toLocaleString('vi-VN', {
                  style: 'currency',
                  currency: 'VND'
                })}
              </span>
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="ticket-qr-section">
          <p className="qr-label">Mã QR - Quét tại điểm vào cổng</p>
          <div className="qr-code-wrapper">
            <QRCode
              ref={qrRef}
              value={ticket.encryptedId}
              size={200}
              level="M"
              includeMargin={true}
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>
          <p className="qr-encoded">{ticket.encryptedId}</p>
        </div>

        {/* Customer & Order Info */}
        <div className="ticket-footer">
          <div className="customer-info">
            <p><strong>Khách hàng:</strong> {ticket.customerName}</p>
            <p><strong>Mã đơn hàng:</strong> {ticket.orderCode}</p>
            <p><strong>Ngày đặt:</strong> {new Date(ticket.createdAt).toLocaleDateString('vi-VN')}</p>
          </div>

          <div className="ticket-warning">
            <p><FaExclamationTriangle className="warning-icon" /> <strong>Lưu ý quan trọng:</strong></p>
            <ul>
              <li>Mỗi vé chỉ được sử dụng một lần</li>
              <li>Vui lòng đến sự kiện trước 15 phút</li>
              <li>Mang theo vé này khi check-in</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="ticket-actions">
        <button className="btn btn-primary" onClick={downloadTicketPDF}>
          <FaDownload /> Tải xuống PDF
        </button>
        <button className="btn btn-secondary" onClick={downloadQRCode}>
          <FaDownload /> Tải QR Code
        </button>
        <button className="btn btn-tertiary" onClick={shareTicket}>
          <FaShare /> Chia sẻ
        </button>
      </div>

      {/* Mobile Optimization */}
      <div className="ticket-mobile-hint">
        <p><FaInfoCircle className="hint-icon" /> Lưu ảnh này hoặc chụp màn hình để giữ vé trên thiết bị của bạn</p>
      </div>
    </div>
  );
};

export default ETicket;
