import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// 1. IMPORT ICON CHUYÊN NGHIỆP
import { FaCalendarAlt, FaMapMarkerAlt, FaTicketAlt } from "react-icons/fa";

const CheckoutPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { event, ticket } = location.state || {};
  const [quantity, setQuantity] = useState(1);

  // Giới hạn mỗi lần mua từ cấu hình hạng vé (max_per_order)
  const maxPerOrder = ticket?.max_per_order || 10;

  // Tính toán số lượng tối đa thực tế: nhỏ hơn giữa kho còn và giới hạn đơn
  const maxAllowed = Math.min(ticket?.quantity_available || 0, maxPerOrder);

  if (!event || !ticket) {
    return <div style={{ padding: '50px', color: 'white', textAlign: 'center' }}>Dữ liệu không hợp lệ. <button onClick={() => navigate('/')}>Về trang chủ</button></div>;
  }

  const totalPrice = ticket.price * quantity;
  const serviceFee  = Math.round(totalPrice * 0.035);
  const finalTotal  = totalPrice + serviceFee;

  const handleConfirmPayment = async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      alert("Phiên đăng nhập hết hạn.");
      navigate('/login');
      return;
    }

    if (quantity > ticket.quantity_available) {
      alert("Số lượng vé trong kho không đủ!");
      return;
    }
    if (quantity > maxPerOrder) {
      alert(`Bạn chỉ được mua tối đa ${maxPerOrder} vé mỗi lần!`);
      return;
    }

    const commission = totalPrice * 0.035;
    const orderData = {
      event_id: event.id,
      ticket_id: ticket.id,
      quantity,
      total_amount: totalPrice,
      commission,
      event_title: event.title,
      event_location: event.location,
      ticket_type: ticket.type,
      selected_date: event.selected_date || null,
      schedule_time: event.schedule_time || null,
      schedule_id: event.schedule_id || null,
    };

    try {
      const res = await fetch('/api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event_id: event.id, ticket_data: orderData }),
      });
      const data = await res.json();

      if (data.position === 0) {
        // Đến lượt ngay — vào thanh toán
        navigate('/payment', { state: { orderData } });
      } else {
        // Phải chờ — vào phòng chờ
        navigate('/waiting-room', {
          replace: true,
          state: {
            event_id: event.id,
            event_title: event.title,
            queue_number: data.queue_number,
            position: data.position,
            estimated_wait_seconds: data.estimated_wait_seconds,
            ticket_data: orderData,
          }
        });
      }
    } catch (err) {
      // Nếu queue lỗi, cho vào thanh toán bình thường
      navigate('/payment', { state: { orderData } });
    }
  };


  return (
    <div className="container" style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto', color: '#eee' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Xác nhận đơn hàng</h1>

      <div style={{ background: '#1e1e1e', padding: '30px', borderRadius: '12px', border: '1px solid #333', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>

        {/* Thông tin sự kiện */}
        <div style={{ borderBottom: '1px solid #444', paddingBottom: '20px', marginBottom: '20px' }}>
          <h2 style={{ marginTop: 0, color: '#2CC275', fontSize: '24px' }}>{event.title}</h2>

          {/* 2. THAY THẾ EMOJI BẰNG ICON */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', color: '#ccc' }}>
            <FaMapMarkerAlt style={{ marginRight: '10px', color: '#2CC275', minWidth: '16px' }} />
            <span>{event.location}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#ccc' }}>
            <FaCalendarAlt style={{ marginRight: '10px', color: '#2CC275', minWidth: '16px' }} />
            <span>
              {event.selected_date
                ? new Date(event.selected_date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
                : new Date(event.event_date).toLocaleString('vi-VN')
              }
              {event.schedule_time && (
                <span style={{ marginLeft: '6px', color: '#2CC275' }}>({event.schedule_time})</span>
              )}
            </span>
          </div>
        </div>

        {/* Thông tin vé */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <FaTicketAlt style={{ marginRight: '10px', color: '#aaa' }} />
              Loại vé:
            </span>
            <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{ticket.type}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span>Đơn giá:</span>
            <span>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(ticket.price)}</span>
          </div>

          {/* Chọn số lượng (Đã áp dụng giới hạn) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', background: '#2a2a2a', padding: '15px', borderRadius: '8px' }}>
            <span>Số lượng (Tối đa: {maxAllowed})</span>
            <input
              type="number"
              min="1"
              max={maxAllowed} // <-- Áp dụng giới hạn tại đây
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                // Logic chặn không cho nhập quá giới hạn
                if (val > maxAllowed) setQuantity(maxAllowed);
                else if (val < 1) setQuantity(1);
                else setQuantity(val);
              }}
              style={{
                width: '70px',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #555',
                background: '#121212',
                color: 'white',
                textAlign: 'center',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            />
          </div>
        </div>

        {/* Tổng tiền */}
        <div style={{ borderTop: '1px solid #444', paddingTop: '20px', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '15px', color: '#aaa' }}>Giá gốc:</span>
            <span style={{ fontSize: '15px', color: '#ccc', fontWeight: '600' }}>
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalPrice)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '15px', color: '#aaa', display: 'flex', alignItems: 'center', gap: 8 }}>
              Phí dịch vụ
              <span style={{ background: 'rgba(44,194,117,0.12)', color: '#2CC275', fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>3.5%</span>
            </span>
            <span style={{ fontSize: '15px', color: '#aaa' }}>
              +{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(serviceFee)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #333', paddingTop: '14px' }}>
            <span style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>Tổng cộng:</span>
            <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#2CC275' }}>
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(finalTotal)}
            </span>
          </div>
        </div>

        {/* Nút hành động */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '30px' }}>
          <button
            onClick={handleConfirmPayment}
            style={{
              width: '100%',
              padding: '15px',
              background: '#2CC275',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background 0.3s',
            }}
          >
            Xác nhận thanh toán
          </button>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: '100%',
              padding: '13px',
              background: 'transparent',
              color: '#888',
              border: '1px solid #444',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => { e.target.style.borderColor = '#2CC275'; e.target.style.color = '#2CC275'; }}
            onMouseLeave={e => { e.target.style.borderColor = '#444'; e.target.style.color = '#888'; }}
          >
            ← Quay lại chọn hạng vé
          </button>
        </div>

      </div>
    </div>
  );
};

export default CheckoutPage;