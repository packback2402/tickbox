import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import ETicket from '../components/ETicket';
// Import icon chuyên nghiệp
import { FaCalendarAlt, FaMapMarkerAlt, FaTicketAlt, FaHistory, FaChevronDown, FaChevronUp, FaCheckCircle, FaClock, FaBan, FaTimesCircle, FaQrcode, FaArrowLeft } from "react-icons/fa";

// Helper: map item_status -> display info
const getStatusInfo = (status) => {
  switch (status) {
    case 'active':
      return { label: 'Còn hiệu lực', color: '#2CC275', icon: <FaCheckCircle style={{ marginRight: '6px' }} /> };
    case 'used':
      return { label: 'Đã sử dụng', color: '#34a8db', icon: <FaCheckCircle style={{ marginRight: '6px' }} /> };
    case 'confirmed':
      return { label: 'Đã xác nhận', color: '#2CC275', icon: <FaCheckCircle style={{ marginRight: '6px' }} /> };
    case 'pending':
      return { label: 'Chờ xác nhận', color: '#FFB84D', icon: <FaClock style={{ marginRight: '6px' }} /> };
    case 'cancelled':
      return { label: 'Đã huỷ', color: '#ff4d4f', icon: <FaTimesCircle style={{ marginRight: '6px' }} /> };
    case 'expired':
      return { label: 'Đã hết hạn', color: '#999', icon: <FaBan style={{ marginRight: '6px' }} /> };
    default:
      return { label: status || 'Không rõ', color: '#888', icon: <FaClock style={{ marginRight: '6px' }} /> };
  }
};

const MyTicketsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [selectedETicket, setSelectedETicket] = useState(null);
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
        const res = await api.get('/api/orders/mine');
        setTickets(res.data);
      } catch (err) {
        console.error("Lỗi tải vé:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMyTickets();
  }, [navigate]);

  const toggleTicketExpand = (index) => {
    setExpandedTicket(expandedTicket === index ? null : index);
  };

  if (loading) return <div style={{ textAlign: 'center', color: 'white', marginTop: '50px' }}>Đang tải dữ liệu...</div>;

  // If viewing e-ticket, show it in full screen
  if (selectedETicket) {
    return (
      <div className="container" style={{ padding: '20px 0', maxWidth: '100%', margin: '0 auto' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <button
            onClick={() => setSelectedETicket(null)}
            style={{
              marginBottom: '20px',
              padding: '10px 20px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FaArrowLeft /> Quay lại
          </button>
          <ETicket
            orderItemId={selectedETicket.orderItemId}
            subIndex={selectedETicket.subIndex}
            key={`${selectedETicket.orderItemId}-${selectedETicket.subIndex}`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto', color: '#eee' }}>

      <h1 style={{ textAlign: 'center', marginBottom: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FaHistory style={{ marginRight: '10px', color: '#2CC275' }} /> Vé của tôi
      </h1>

      {tickets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', background: '#1e1e1e', borderRadius: '10px' }}>
          <h3>Bạn chưa mua vé nào cả</h3>
          <button
            onClick={() => navigate('/')}
            style={{ marginTop: '20px', padding: '10px 20px', background: '#2CC275', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Mua vé ngay
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {tickets.map((ticket, index) => {
            const statusInfo = getStatusInfo(ticket.item_status);
            const subIndex = ticket.sub_index || 1;
            const cardKey = `${ticket.order_item_id}-${subIndex}`;
            return (
              <div key={cardKey} style={{
                background: '#1e1e1e',
                borderRadius: '12px',
                border: '1px solid #333',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                overflow: 'hidden'
              }}>
                {/* Main Ticket Card */}
                <div
                  onClick={() => toggleTicketExpand(index)}
                  style={{
                    padding: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    background: expandedTicket === index ? '#262626' : '#1e1e1e'
                  }}
                >
                  {/* Hình ảnh sự kiện */}
                  <img
                    src={ticket.image_url || 'https://via.placeholder.com/150'}
                    alt={ticket.event_title}
                    style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', marginRight: '20px' }}
                  />

                  {/* Thông tin chi tiết */}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#2CC275' }}>{ticket.event_title}</h3>

                    <div style={{ display: 'flex', gap: '20px', color: '#ccc', fontSize: '0.9rem', marginBottom: '10px', flexWrap: 'wrap' }}>
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
                        {ticket.ticket_type}
                        {ticket.total_quantity > 1 && (
                          <span style={{ marginLeft: '10px', fontSize: '0.8rem', fontWeight: 'normal', color: '#888' }}>
                            Vé {ticket.sub_index}/{ticket.total_quantity}
                          </span>
                        )}
                      </span>
                      <span style={{ color: '#2CC275', fontWeight: 'bold' }}>
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(ticket.price * ticket.quantity)}
                      </span>
                    </div>

                    <p style={{ margin: '10px 0 0 0', fontSize: '0.8rem', color: '#666' }}>
                      Ngày đặt: {new Date(ticket.order_date).toLocaleString('vi-VN')}
                    </p>
                  </div>

                  {/* Expand Icon */}
                  <div style={{ marginLeft: '20px', color: '#999', fontSize: '20px' }}>
                    {expandedTicket === index ? <FaChevronUp /> : <FaChevronDown />}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedTicket === index && (
                  <div style={{
                    borderTop: '1px solid #333',
                    padding: '20px',
                    background: '#262626',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px'
                  }}>
                    <div style={{ 
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '15px',
                      fontSize: '0.9rem',
                      color: '#ccc'
                    }}>
                      <div>
                        <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '0.8rem', textTransform: 'uppercase' }}>Mã đơn hàng</p>
                        <p style={{ margin: '0', fontWeight: 'bold', color: '#fff' }}>{ticket.order_code}</p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '0.8rem', textTransform: 'uppercase' }}>Trạng thái</p>
                        <p style={{ 
                          margin: '0', 
                          fontWeight: 'bold',
                          color: statusInfo.color,
                          display: 'flex',
                          alignItems: 'center',
                        }}>
                          {statusInfo.icon}
                          {statusInfo.label}
                        </p>
                      </div>
                    </div>

                    {/* E-Ticket Button */}
                    <button
                      onClick={() => setSelectedETicket({ orderItemId: ticket.order_item_id, subIndex: ticket.sub_index || 1 })}
                      style={{
                        padding: '12px 20px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <FaQrcode /> Xem E-Ticket
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyTicketsPage;