import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
// Import icon cho đẹp
import { FaCalendarAlt, FaMapMarkerAlt, FaTicketAlt, FaHistory } from "react-icons/fa";

const MyTicketsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMyTickets = async () => {
      const token = localStorage.getItem('token');
      
      // Nếu chưa đăng nhập thì đuổi về trang login
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const res = await axios.get('http://127.0.0.1:5000/api/orders/mine', {
          headers: { 'x-auth-token': token }
        });
        setTickets(res.data);
      } catch (err) {
        console.error("Lỗi tải vé:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMyTickets();
  }, [navigate]);

  if (loading) return <div style={{textAlign: 'center', color: 'white', marginTop: '50px'}}>Đang tải dữ liệu...</div>;

  return (
    <div className="container" style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto', color: '#eee' }}>
      
      <h1 style={{ textAlign: 'center', marginBottom: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FaHistory style={{ marginRight: '10px', color: '#2CC275' }} /> Lịch sử đặt vé
      </h1>

      {tickets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', background: '#1e1e1e', borderRadius: '10px' }}>
          <h3>Bạn chưa mua vé nào cả 😢</h3>
          <button 
            onClick={() => navigate('/')}
            style={{ marginTop: '20px', padding: '10px 20px', background: '#2CC275', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Mua vé ngay
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {tickets.map((ticket) => (
            <div key={`${ticket.order_id}-${ticket.ticket_type}`} style={{ 
              background: '#1e1e1e', 
              padding: '20px', 
              borderRadius: '12px', 
              border: '1px solid #333',
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}>
              {/* Hình ảnh sự kiện (Nhỏ) */}
              <img 
                src={ticket.image_url || 'https://via.placeholder.com/150'} 
                alt={ticket.event_title}
                style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', marginRight: '20px' }} 
              />

              {/* Thông tin chi tiết */}
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2CC275' }}>{ticket.event_title}</h3>
                
                <div style={{ display: 'flex', gap: '20px', color: '#ccc', fontSize: '0.9rem', marginBottom: '10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <FaCalendarAlt style={{ marginRight: '5px' }} /> 
                    {new Date(ticket.event_date).toLocaleDateString('vi-VN')}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <FaMapMarkerAlt style={{ marginRight: '5px' }} /> 
                    {ticket.location}
                  </span>
                </div>

                <div style={{ background: '#2a2a2a', padding: '10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
                    <FaTicketAlt style={{ marginRight: '8px', color: '#aaa' }} />
                    {ticket.ticket_type} <span style={{ marginLeft: '10px', fontSize: '0.8rem', fontWeight: 'normal', color: '#888' }}>(x{ticket.quantity})</span>
                  </span>
                  <span style={{ color: '#2CC275', fontWeight: 'bold' }}>
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(ticket.price * ticket.quantity)}
                  </span>
                </div>
                
                <p style={{ margin: '10px 0 0 0', fontSize: '0.8rem', color: '#666' }}>
                  Ngày đặt: {new Date(ticket.order_date).toLocaleString('vi-VN')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyTicketsPage;