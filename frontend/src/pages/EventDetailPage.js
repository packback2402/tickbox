import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; // 1. Thêm useNavigate
import api from '../api';
// IMPORT ICON
import { FaCalendar, FaArrowLeft, FaChair } from "react-icons/fa";
import { MdPlace } from "react-icons/md";
import EventSchedule from '../components/EventSchedule';

const EventDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate(); // 2. Khởi tạo navigate

  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null); // Ngày được chọn từ lịch diễn
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    const fetchEventDetails = async () => {
      try {
        const eventRes = await api.get(`/api/events/${id}`);
        setEvent(eventRes.data);

        const ticketRes = await api.get(`/api/tickets/${id}`);
        setTickets(ticketRes.data);

        // Fetch schedules for multi-day events
        try {
          const scheduleRes = await api.get(`/api/events/${id}/schedules`);
          setSchedules(scheduleRes.data);
        } catch (e) {
          // Schedules may not exist — that's fine
        }

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

    // Sự kiện nhiều ngày — bắt buộc chọn ngày trước
    if (isMultiDay && !selectedSchedule) {
      alert("Vui lòng chọn ngày diễn trước khi mua vé!");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Đã đăng nhập -> Chuyển sang trang Checkout và mang theo thông tin vé + sự kiện
    const eventForCheckout = selectedSchedule
      ? { ...event, selected_date: selectedSchedule.selected_date, schedule_time: selectedSchedule.schedule_time }
      : event;

    navigate('/checkout', { state: { event: eventForCheckout, ticket } });
  };

  // Callback khi chọn ngày từ EventSchedule
  const handleSelectDate = (scheduleInfo) => {
    setSelectedSchedule(scheduleInfo);
  };

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px', color: '#eee' }}>Đang tải...</div>;
  if (error) return <div style={{ color: 'red', textAlign: 'center', marginTop: '50px' }}>{error}</div>;
  if (!event) return <div style={{ textAlign: 'center', marginTop: '50px', color: '#eee' }}>Không tìm thấy sự kiện</div>;

  const isEnded = event && new Date(event.end_date || event.event_date) < new Date();
  const isMultiDay = schedules.length > 0;

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', color: '#ccc' }}>
        {/* Ngày giờ */}
        <p style={{ display: 'flex', alignItems: 'center', margin: 0 }}>
          <FaCalendar style={{ marginRight: '10px', color: '#2CC275', flexShrink: 0 }} />
          <span>
            {new Date(event.event_date).toLocaleString('vi-VN', {
              weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
            {event.end_date && (
              <span style={{ marginLeft: 6 }}>
                {' — '}
                {new Date(event.end_date).toLocaleString('vi-VN', {
                  weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
          </span>
        </p>
        {/* Địa điểm */}
        <p style={{ display: 'flex', alignItems: 'flex-start', margin: 0 }}>
          <MdPlace style={{ marginRight: '10px', color: '#2CC275', fontSize: '18px', flexShrink: 0, marginTop: 1 }} />
          <span>{event.location}</span>
        </p>
      </div>


      <div style={{ background: '#1e1e1e', padding: '20px', borderRadius: '10px', marginBottom: '30px', border: '1px solid #333' }}>
        <h3 style={{ marginTop: 0, color: '#2CC275' }}>Giới thiệu sự kiện</h3>

          {/* Collapsible description */}
          <div style={{ position: 'relative' }}>
            {event.description ? (
              <div
                dangerouslySetInnerHTML={{ __html: event.description }}
                className="event-description-html"
                style={{
                  lineHeight: '1.7',
                  color: '#ddd',
                  margin: 0,
                  overflow: 'hidden',
                  maxHeight: descExpanded ? 'none' : '6.8em',
                  transition: 'max-height 0.4s ease',
                }}
              />
            ) : <p>Chưa có mô tả cho sự kiện này.</p>}

          {/* Gradient fade — chỉ hiện khi đang thu gọn */}
          {!descExpanded && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: '48px',
              background: 'linear-gradient(to bottom, transparent, #1e1e1e)',
              pointerEvents: 'none',
            }} />
          )}
        </div>

        {/* Nút toggle */}
        <button
          onClick={() => setDescExpanded(v => !v)}
          style={{
            marginTop: '10px',
            background: 'transparent',
            border: 'none',
            color: '#2CC275',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            padding: '2px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            letterSpacing: '0.3px',
          }}
        >
          {descExpanded ? '▲ Thu gọn' : '▼ Xem thêm'}
        </button>
      </div>

      {isMultiDay && !isEnded && (
        <EventSchedule
          eventId={id}
          event={event}
          tickets={tickets}
          onSelectDate={handleSelectDate}
        />
      )}

      <div id="ticket-section">
        <h3>Thông tin vé</h3>
      </div>

      {/* Hiển thị ngày đã chọn từ lịch diễn */}
      {isMultiDay && selectedSchedule && (
        <div style={{
          background: '#2CC27515',
          border: '1px solid #2CC275',
          borderRadius: '8px',
          padding: '12px 20px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FaCalendar style={{ color: '#2CC275' }} />
            <span style={{ color: '#2CC275', fontWeight: '600' }}>
              Ngày đã chọn: {new Date(selectedSchedule.selected_date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
            <span style={{ color: '#888', fontSize: '13px' }}>
              ({selectedSchedule.schedule_time})
            </span>
          </div>
          <button
            onClick={() => setSelectedSchedule(null)}
            style={{
              background: 'transparent', border: '1px solid #2CC275', color: '#2CC275',
              padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
            }}
          >
            Đổi ngày
          </button>
        </div>
      )}

      {/* Thông báo cần chọn ngày trước */}
      {isMultiDay && !selectedSchedule && !isEnded && (
        <div style={{
          background: '#FFC10715',
          border: '1px solid #FFC10750',
          borderRadius: '8px',
          padding: '12px 20px',
          marginBottom: '16px',
          color: '#FFC107',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <FaCalendar />
          Vui lòng chọn ngày diễn ở phần Lịch diễn phía trên trước khi mua vé.
        </div>
      )}

      {isEnded && (
        <div style={{ background: '#e74c3c20', padding: '15px', borderRadius: '8px', border: '1px solid #e74c3c', color: '#e74c3c', textAlign: 'center', marginBottom: '20px', fontWeight: 'bold' }}>
          Sự kiện này đã kết thúc. Bạn không thể giao dịch mua vé nữa.
        </div>
      )}

      {/* Nút chọn chỗ ngồi nếu event có seatmap */}
      {!isEnded && event.has_seatmap && (
        <div style={{
          background: 'linear-gradient(135deg, #1a2a1e, #1e3a25)', padding: '24px', borderRadius: '12px',
          marginBottom: '20px', border: '1px solid #2CC275', textAlign: 'center'
        }}>
          <FaChair style={{ fontSize: '32px', color: '#2CC275', marginBottom: '10px' }} />
          <h3 style={{ color: '#2CC275', marginBottom: '8px' }}>Sự kiện có sơ đồ chỗ ngồi</h3>
          <p style={{ color: '#aaa', marginBottom: '16px', fontSize: '14px' }}>
            {event.seatmap_type === 'zone' ? 'Chọn khu vực và số lượng vé' : event.seatmap_type === 'mixed' ? 'Có cả khu vực đứng và ghế ngồi có số' : 'Chọn chính xác ghế bạn muốn ngồi'}
          </p>
          <button
            onClick={() => navigate(`/events/${id}/seatmap`)}
            style={{
              background: '#2CC275', color: 'white', border: 'none', padding: '14px 40px',
              borderRadius: '8px', fontSize: '16px', fontWeight: '700', cursor: 'pointer',
              transition: 'all 0.3s', boxShadow: '0 4px 12px rgba(44,194,117,0.3)'
            }}
            onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.target.style.transform = 'translateY(0)'}
          >
            Mở sơ đồ chỗ ngồi
          </button>
        </div>
      )}

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
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2CC275' }}>
                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(ticket.price)}
                </div>

                {/* 4. Gắn sự kiện onClick vào nút button */}
                {!event.has_seatmap && (
                  <button
                    disabled={isEnded || ticket.quantity_available <= 0 || (isMultiDay && !selectedSchedule)}
                    onClick={() => handleBuyTicket(ticket)}
                    style={{
                    background: (!isEnded && ticket.quantity_available > 0 && (!isMultiDay || selectedSchedule)) ? '#2CC275' : '#555',
                    color: 'white',
                    border: 'none',
                    padding: '8px 15px',
                    borderRadius: '5px',
                    cursor: (!isEnded && ticket.quantity_available > 0 && (!isMultiDay || selectedSchedule)) ? 'pointer' : 'not-allowed',
                    marginTop: '10px',
                    fontWeight: 'bold'
                  }}>
                  {isEnded ? 'Đã kết thúc' : (ticket.quantity_available > 0 ? (isMultiDay && !selectedSchedule ? 'Chọn ngày trước' : 'Chọn vé') : 'Hết vé')}
                </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default EventDetailPage;