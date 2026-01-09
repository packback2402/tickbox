import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; // 1. Thêm useNavigate
import axios from 'axios';
// IMPORT ICON
import { FaCalendar, FaArrowLeft } from "react-icons/fa";
import { MdPlace } from "react-icons/md";

const EventDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate(); // 2. Khởi tạo navigate
  
  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEventDetails = async () => {
      try {
        const eventRes = await axios.get(`http://127.0.0.1:5000/api/events/${id}`);
        setEvent(eventRes.data);

        const ticketRes = await axios.get(`http://127.0.0.1:5000/api/tickets/${id}`);
        setTickets(ticketRes.data);

        setLoading(false);
      } catch (err) {
        console.error("Lỗi khi tải chi tiết sự kiện:", err);
        setError("Không thể tải thông tin sự kiện.");
        setLoading(false);
      }
    };

    fetchEventDetails();
  }, [id]);

  // 3. Hàm xử lý khi bấm nút Mua vé
  const handleBuyTicket = (ticket) => {
    // Kiểm tra xem user đã đăng nhập chưa
    const token = localStorage.getItem('token');
    
    if (!token) {
      alert("Vui lòng đăng nhập để mua vé!");
      navigate('/login'); // Chưa đăng nhập -> Chuyển sang trang Login
      return;
    }

    // Đã đăng nhập -> Chuyển sang trang Checkout và mang theo thông tin vé + sự kiện
    navigate('/checkout', { state: { event, ticket } });
  };

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px', color: '#eee' }}>Đang tải...</div>;
  if (error) return <div style={{ color: 'red', textAlign: 'center', marginTop: '50px' }}>{error}</div>;
  if (!event) return <div style={{ textAlign: 'center', marginTop: '50px', color: '#eee' }}>Không tìm thấy sự kiện</div>;

  return (
    <div className="container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', color: '#eee' }}>
      <Link to="/" style={{ textDecoration: 'none', color: '#aaa', marginBottom: '20px', display: 'inline-flex', alignItems: 'center' }}>
         <FaArrowLeft style={{ marginRight: '8px' }} /> Quay lại trang chủ
      </Link>

      {/* Ảnh bìa sự kiện */}
      <img 
        src={event.image_url || 'https://via.placeholder.com/800x400?text=No+Image'} 
        alt={event.title} 
        style={{ width: '100%', height: '400px', objectFit: 'cover', borderRadius: '10px' }}
      />

      <h1>{event.title}</h1>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', color: '#ccc' }}>
        <p style={{ display: 'flex', alignItems: 'center' }}>
           <FaCalendar style={{ marginRight: '8px', color: '#2CC275' }} /> 
           {new Date(event.event_date).toLocaleString('vi-VN')}
        </p>
        <p style={{ display: 'flex', alignItems: 'center' }}>
           <MdPlace style={{ marginRight: '8px', color: '#2CC275', fontSize: '18px' }} /> 
           {event.location}
        </p>
      </div>

      <div style={{ background: '#1e1e1e', padding: '20px', borderRadius: '10px', marginBottom: '30px', border: '1px solid #333' }}>
        <h3 style={{ marginTop: 0, color: '#2CC275' }}>Giới thiệu sự kiện</h3>
        <p style={{ whiteSpace: 'pre-line', lineHeight: '1.5', color: '#ddd' }}>{event.description}</p>
      </div>

      <h3>Thông tin vé</h3>
      {tickets.length === 0 ? (
        <p style={{ color: '#aaa' }}>Chưa có thông tin vé cho sự kiện này.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {tickets.map(ticket => (
            <li key={ticket.id} style={{ 
              border: '1px solid #333', 
              background: '#1e1e1e',
              padding: '15px', 
              marginBottom: '10px', 
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <strong style={{ fontSize: '1.1rem', color: '#fff' }}>{ticket.type}</strong>
                <p style={{ margin: '5px 0 0', color: '#aaa' }}>Còn lại: <span style={{ color: '#2CC275' }}>{ticket.quantity_available}</span> vé</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2CC275' }}>
                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(ticket.price)}
                </div>
                
                {/* 4. Gắn sự kiện onClick vào nút button */}
                <button 
                  disabled={ticket.quantity_available <= 0}
                  onClick={() => handleBuyTicket(ticket)} // <--- GỌI HÀM Ở ĐÂY
                  style={{ 
                    background: ticket.quantity_available > 0 ? '#2CC275' : '#555', 
                    color: 'white', 
                    border: 'none', 
                    padding: '8px 15px', 
                    borderRadius: '5px', 
                    cursor: ticket.quantity_available > 0 ? 'pointer' : 'not-allowed',
                    marginTop: '10px',
                    fontWeight: 'bold'
                }}>
                  {ticket.quantity_available > 0 ? 'Chọn vé' : 'Hết vé'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default EventDetailPage;