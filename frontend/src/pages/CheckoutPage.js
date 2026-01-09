import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
// 1. IMPORT ICON CHUYÊN NGHIỆP
import { FaCalendarAlt, FaMapMarkerAlt, FaTicketAlt } from "react-icons/fa";

const CheckoutPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { event, ticket } = location.state || {};
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  // --- CẤU HÌNH GIỚI HẠN MUA ---
  const MAX_PER_ORDER = 2; // Giới hạn mỗi lần chỉ được mua tối đa 2 vé
  
  // Tính toán số lượng tối đa được phép chọn
  // (Lấy số nhỏ hơn giữa: Kho vé còn lại VÀ Giới hạn cho phép)
  const maxAllowed = Math.min(ticket?.quantity_available || 0, MAX_PER_ORDER);

  if (!event || !ticket) {
    return <div style={{padding: '50px', color: 'white', textAlign: 'center'}}>Dữ liệu không hợp lệ. <button onClick={() => navigate('/')}>Về trang chủ</button></div>;
  }

  const totalPrice = ticket.price * quantity;

  const handleConfirmPayment = async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
        alert("Phiên đăng nhập hết hạn.");
        navigate('/login');
        return;
    }

    // Kiểm tra lại logic số lượng trước khi gửi
    if (quantity > ticket.quantity_available) {
        alert("Số lượng vé trong kho không đủ!");
        return;
    }
    if (quantity > MAX_PER_ORDER) {
        alert(`Bạn chỉ được mua tối đa ${MAX_PER_ORDER} vé mỗi lần!`);
        return;
    }

    setLoading(true);
    try {
      await axios.post(
        'http://127.0.0.1:5000/api/orders', 
        {
          ticket_id: ticket.id,
          quantity: quantity
        },
        {
          headers: { 'x-auth-token': token }
        }
      );

      alert("🎉 Đặt vé thành công!");
      navigate('/'); 
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || "Có lỗi xảy ra khi thanh toán.");
    } finally {
      setLoading(false);
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
                <span>{new Date(event.event_date).toLocaleString('vi-VN')}</span>
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
        <div style={{ borderTop: '1px solid #444', paddingTop: '20px', marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '18px' }}>Tổng cộng:</span>
            <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#2CC275' }}>
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalPrice)}
            </span>
        </div>

        {/* Nút thanh toán */}
        <button 
            onClick={handleConfirmPayment}
            disabled={loading}
            style={{ 
                width: '100%', 
                marginTop: '30px', 
                padding: '15px', 
                background: loading ? '#555' : '#2CC275', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                fontSize: '18px', 
                fontWeight: 'bold', 
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.3s'
            }}
        >
            {loading ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
        </button>

      </div>
    </div>
  );
};

export default CheckoutPage;